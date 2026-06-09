import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { groupAttendees, attachProfiles, type BookingLike } from "@/lib/attendees";

// Aggregate attendee insights across all of the host's events.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: all } = await supabase
    .from("bookings")
    .select("id, listing_id, customer_id, guest_name, guest_email, checked_in_at, created_at, status")
    .eq("creator_id", user.id)
    .in("status", ["confirmed", "completed"]);

  const bookings = await attachProfiles(createAdminClient(), (all ?? []) as unknown as BookingLike[]);
  const attendees = groupAttendees(bookings);

  const uniqueAttendees = attendees.size;
  let returning = 0;
  let totalCheckedIn = 0;
  const topReturning: { name: string; email: string | null; eventsCount: number; lastSeen: string }[] = [];
  for (const a of Array.from(attendees.values())) {
    totalCheckedIn += a.checkedIn;
    if (a.eventIds.size >= 2) {
      returning += 1;
      topReturning.push({ name: a.name, email: a.email, eventsCount: a.eventIds.size, lastSeen: a.lastSeen });
    }
  }
  topReturning.sort((x, y) => y.eventsCount - x.eventsCount || y.lastSeen.localeCompare(x.lastSeen));

  // Per-event summary
  const listingIds = Array.from(new Set(bookings.map((b) => b.listing_id)));
  const titleById = new Map<string, { title: string; event_date: string | null }>();
  if (listingIds.length) {
    const { data: listings } = await supabase
      .from("listings")
      .select("id, title, event_date")
      .in("id", listingIds);
    for (const l of listings ?? []) titleById.set(l.id, { title: l.title, event_date: l.event_date });
  }
  const perEventMap = new Map<string, { bookings: number; checkedIn: number }>();
  for (const b of bookings) {
    const cur = perEventMap.get(b.listing_id) ?? { bookings: 0, checkedIn: 0 };
    cur.bookings += 1;
    if (b.checked_in_at) cur.checkedIn += 1;
    perEventMap.set(b.listing_id, cur);
  }
  const perEvent = Array.from(perEventMap.entries())
    .map(([id, v]) => ({
      id,
      title: titleById.get(id)?.title ?? "Event",
      eventDate: titleById.get(id)?.event_date ?? null,
      bookings: v.bookings,
      checkedIn: v.checkedIn,
    }))
    .sort((a, b) => (b.eventDate ?? "").localeCompare(a.eventDate ?? ""));

  return NextResponse.json({
    uniqueAttendees,
    returning,
    new: uniqueAttendees - returning,
    returningRate: uniqueAttendees > 0 ? Math.round((returning / uniqueAttendees) * 100) : 0,
    totalCheckedIn,
    totalBookings: bookings.length,
    eventCount: listingIds.length,
    topReturning: topReturning.slice(0, 50),
    perEvent,
  });
}
