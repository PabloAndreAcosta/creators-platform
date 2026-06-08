import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const ROLES = ["creator", "taxi_dancer", "volunteer", "co_host"] as const;
type CollabRole = (typeof ROLES)[number];

function isCollabRole(r: unknown): r is CollabRole {
  return typeof r === "string" && (ROLES as readonly string[]).includes(r);
}

function generateToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: listingId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: listing } = await supabase
    .from("listings")
    .select("id, user_id, title")
    .eq("id", listingId)
    .single();

  if (!listing || listing.user_id !== user.id) {
    return NextResponse.json({ error: "Not the host of this listing" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const role = body?.role;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : null;
  const phone = typeof body?.phone === "string" ? body.phone.trim() : null;
  const invitedUserId = typeof body?.user_id === "string" ? body.user_id.trim() : null;

  if (!isCollabRole(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  if (!email && !phone && !invitedUserId) {
    return NextResponse.json({ error: "Email, phone or user is required" }, { status: 400 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Direct invite to an existing app user: validate and dedupe.
  let invitedProfile: { id: string; full_name: string | null; avatar_url: string | null } | null = null;
  if (invitedUserId) {
    if (invitedUserId === user.id) {
      return NextResponse.json({ error: "Du är redan värd för den här produktionen" }, { status: 400 });
    }
    const { data: profile } = await admin
      .from("profiles")
      .select("id, full_name, avatar_url")
      .eq("id", invitedUserId)
      .maybeSingle();
    if (!profile) {
      return NextResponse.json({ error: "Användaren hittades inte" }, { status: 404 });
    }
    invitedProfile = profile;

    const { data: existingCollab } = await admin
      .from("listing_collaborators")
      .select("status")
      .eq("listing_id", listingId)
      .eq("user_id", invitedUserId)
      .eq("status", "accepted")
      .maybeSingle();
    if (existingCollab) {
      return NextResponse.json({ error: "Personen är redan med i crewet" }, { status: 409 });
    }

    const { data: existingInvite } = await admin
      .from("collaborator_invites")
      .select("id")
      .eq("listing_id", listingId)
      .eq("invited_user_id", invitedUserId)
      .is("accepted_user_id", null)
      .maybeSingle();
    if (existingInvite) {
      return NextResponse.json({ error: "Personen är redan inbjuden" }, { status: 409 });
    }
  }

  const token = generateToken();

  const { data: invite, error } = await supabase
    .from("collaborator_invites")
    .insert({
      listing_id: listingId,
      role,
      token,
      invited_email: email,
      invited_phone: phone,
      invited_user_id: invitedUserId,
      invited_by: user.id,
    })
    .select("id, token, expires_at")
    .single();

  if (error || !invite) {
    return NextResponse.json({ error: "Could not create invite" }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://usha.se";
  const inviteUrl = `${appUrl}/app/invites/${invite.token}`;

  // Notify the invited user in-app so they can find and accept the invite.
  if (invitedUserId) {
    await admin.from("notifications").insert({
      user_id: invitedUserId,
      type: "collab_invite",
      title: "Du har bjudits in till crew",
      message: `Du är inbjuden som ${role === "creator" ? "kreatör" : role === "taxi_dancer" ? "taxidansare" : role === "volunteer" ? "volontär" : "medvärd"} till "${listing.title}".`,
      link: inviteUrl,
      is_read: false,
    });
  }

  return NextResponse.json({
    id: invite.id,
    invite_url: inviteUrl,
    expires_at: invite.expires_at,
    invited_user: invitedProfile,
  });
}
