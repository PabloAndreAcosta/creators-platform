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
