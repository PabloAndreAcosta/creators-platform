import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
  if (typeof body?.can_scan !== "boolean") {
    return NextResponse.json({ error: "can_scan (boolean) is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("listing_collaborators")
    .update({ can_scan: body.can_scan })
    .eq("listing_id", listingId)
    .eq("user_id", collaboratorUserId)
    .eq("status", "accepted");

  if (error) {
    return NextResponse.json({ error: "Could not update collaborator" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, can_scan: body.can_scan });
}
