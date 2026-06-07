import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";

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

  if (!isCollabRole(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  if (!email && !phone) {
    return NextResponse.json({ error: "Email or phone is required" }, { status: 400 });
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
      invited_by: user.id,
    })
    .select("id, token, expires_at")
    .single();

  if (error || !invite) {
    return NextResponse.json({ error: "Could not create invite" }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://usha.se";
  return NextResponse.json({
    id: invite.id,
    invite_url: `${appUrl}/app/invites/${invite.token}`,
    expires_at: invite.expires_at,
  });
}
