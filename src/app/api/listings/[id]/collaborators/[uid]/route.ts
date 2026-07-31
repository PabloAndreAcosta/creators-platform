import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canDelegateScan, canReceiveScan } from "@/lib/scan-access";
import { canDelegateManage } from "@/lib/listings/manage-access";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; uid: string }> }
) {
  const { id: listingId, uid: collaboratorUserId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: listing } = await supabase
    .from("listings")
    .select("user_id")
    .eq("id", listingId)
    .single();

  if (!listing || listing.user_id !== user.id) {
    return NextResponse.json({ error: "Not the host of this listing" }, { status: 403 });
  }

  const { error } = await supabase
    .from("listing_collaborators")
    .update({ status: "removed", removed_at: new Date().toISOString() })
    .eq("listing_id", listingId)
    .eq("user_id", collaboratorUserId);

  if (error) {
    return NextResponse.json({ error: "Could not remove collaborator" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// Host toggles per-collaborator permissions (currently: can_scan tickets).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; uid: string }> }
) {
  const { id: listingId, uid: collaboratorUserId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: listing } = await supabase
    .from("listings")
    .select("user_id")
    .eq("id", listingId)
    .single();

  if (!listing || listing.user_id !== user.id) {
    return NextResponse.json({ error: "Not the host of this listing" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const hasScan = typeof body?.can_scan === "boolean";
  const hasManage = typeof body?.can_manage === "boolean";
  if (!hasScan && !hasManage) {
    return NextResponse.json({ error: "can_scan or can_manage (boolean) is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: hostProfile } = await admin
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .maybeSingle();

  const update: Record<string, boolean> = {};

  if (hasScan) {
    // Only Gold/Premium hosts may delegate scanning.
    if (!canDelegateScan(hostProfile?.tier)) {
      return NextResponse.json(
        { error: "Skanning kan bara delegeras av Guld- eller Premium-konton.", code: "host_not_eligible" },
        { status: 403 }
      );
    }
    // When granting, the recipient must be a paying / creator / experience account.
    if (body.can_scan === true) {
      const { data: recipient } = await admin
        .from("profiles")
        .select("role, tier")
        .eq("id", collaboratorUserId)
        .maybeSingle();
      if (!canReceiveScan(recipient?.role, recipient?.tier)) {
        return NextResponse.json(
          {
            error: "Personen kan inte få skann-rätt — kräver ett betalande, kreatör- eller upplevelsekonto.",
            code: "recipient_not_eligible",
          },
          { status: 403 }
        );
      }
    }
    update.can_scan = body.can_scan;
  }

  if (hasManage) {
    // Co-organizer (manage) may only be delegated by Gold/Premium hosts. Granting
    // is owner-only (this route is owner-gated above), so a co-organizer can't
    // escalate another user to co-organizer.
    if (!canDelegateManage(hostProfile?.tier)) {
      return NextResponse.json(
        { error: "Medarrangör kan bara delegeras av Guld- eller Premium-konton.", code: "host_not_eligible_manage" },
        { status: 403 }
      );
    }
    update.can_manage = body.can_manage;
  }

  const { error } = await supabase
    .from("listing_collaborators")
    .update(update)
    .eq("listing_id", listingId)
    .eq("user_id", collaboratorUserId)
    .eq("status", "accepted");

  if (error) {
    return NextResponse.json({ error: "Could not update collaborator" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ...update });
}
