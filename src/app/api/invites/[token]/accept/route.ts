import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const BANKID_GATED_ROLES = new Set(["creator", "taxi_dancer", "volunteer"]);

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: invite } = await admin
    .from("collaborator_invites")
    .select("id, listing_id, role, expires_at, accepted_user_id, invited_user_id")
    .eq("token", token)
    .maybeSingle();

  if (!invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }
  if (invite.accepted_user_id) {
    return NextResponse.json({ error: "Invite already accepted" }, { status: 409 });
  }
  // Invites targeted at a specific app user can only be accepted by that user.
  if (invite.invited_user_id && invite.invited_user_id !== user.id) {
    return NextResponse.json({ error: "Den här inbjudan gäller någon annan" }, { status: 403 });
  }
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "Invite expired" }, { status: 410 });
  }

  if (BANKID_GATED_ROLES.has(invite.role)) {
    const { data: profile } = await admin
      .from("profiles")
      .select("bankid_verified_at")
      .eq("id", user.id)
      .single();
    if (!profile?.bankid_verified_at) {
      return NextResponse.json({ error: "BankID verification required", code: "bankid_required" }, { status: 403 });
    }
  }

  const { data: collaborator, error: collabErr } = await admin
    .from("listing_collaborators")
    .upsert(
      {
        listing_id: invite.listing_id,
        user_id: user.id,
        role: invite.role,
        status: "accepted",
        invited_at: new Date().toISOString(),
        accepted_at: new Date().toISOString(),
      },
      { onConflict: "listing_id,user_id" }
    )
    .select("id")
    .single();

  if (collabErr || !collaborator) {
    return NextResponse.json({ error: "Could not save collaboration" }, { status: 500 });
  }

  await admin
    .from("collaborator_invites")
    .update({ accepted_user_id: user.id, accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  return NextResponse.json({ ok: true, collaborator_id: collaborator.id, listing_id: invite.listing_id });
}
