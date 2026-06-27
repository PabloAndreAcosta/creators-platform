import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { waitlistToCsv, type WaitlistEntry } from "@/lib/waitlist";

// Owner-only: download the event's waitlist as CSV.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: listingId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: listing } = await admin
    .from("listings")
    .select("id, user_id, slug, title")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing || listing.user_id !== user.id) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const { data: rows } = await admin
    .from("event_waitlist")
    .select("id, listing_id, name, email, source, unsubscribe_token, unsubscribed_at, created_at")
    .eq("listing_id", listingId)
    .order("created_at", { ascending: true });

  const csv = waitlistToCsv((rows ?? []) as WaitlistEntry[]);
  const filename = `vantelista-${listing.slug || listingId}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
