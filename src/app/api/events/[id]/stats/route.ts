import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { attendeeKey, attendeeName, bookingEmail, attachProfiles, type BookingLike } from "@/lib/attendees";
import { canAccessListingArea } from "@/lib/venues/listing-access";
import { stockholmLocalToUtcISO } from "@/lib/time";

// Per-event attendee statistics: how many booked/came, who, and which of them
// are returning (also attended another of the host's events).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: listing } = await admin
    .from("listings")
    .select("id, title, max_guests, user_id, event_date, event_end_time")
    .eq("id", eventId)
    .single();
  // Owner or accepted co-organizer may view stats.
  // `stats` är en egen behörighet i lokalteamet. Den som bara fått "Evenemang"
  // ska inte få statistik på köpet — då vore kryssrutorna lögn.
  if (!listing || (listing.user_id !== user.id && !(await canAccessListingArea(admin, user.id, eventId, "stats")))) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // The OWNER's attendee bookings (read via service role, filtered by the owner's
  // creator_id — not the caller's, so a co-organizer sees the same data). Used
  // both for this event's list and to detect repeat attendees across the owner's
  // events.
  const { data: all } = await admin
    .from("bookings")
    .select("id, listing_id, customer_id, guest_name, guest_email, checked_in_at, created_at, status, amount_paid")
    .eq("creator_id", listing.user_id)
    .in("status", ["confirmed", "completed"]);

  const allBookings = await attachProfiles(admin, (all ?? []) as unknown as BookingLike[]);

  // distinct events per attendee key across the host
  const eventsByKey = new Map<string, Set<string>>();
  for (const b of allBookings) {
    const k = attendeeKey(b);
    if (!eventsByKey.has(k)) eventsByKey.set(k, new Set());
    eventsByKey.get(k)!.add(b.listing_id);
  }

  const eventBookings = allBookings.filter((b) => b.listing_id === eventId);

  // One row per attendee on this event
  const byKey = new Map<string, { name: string; email: string | null; checkedIn: boolean }>();
  for (const b of eventBookings) {
    const k = attendeeKey(b);
    const cur = byKey.get(k);
    if (cur) {
      if (b.checked_in_at) cur.checkedIn = true;
      if (cur.name === "Gäst") cur.name = attendeeName(b);
    } else {
      byKey.set(k, { name: attendeeName(b), email: bookingEmail(b), checkedIn: !!b.checked_in_at });
    }
  }

  const list = Array.from(byKey.entries()).map(([k, v]) => {
    const eventsCount = eventsByKey.get(k)?.size ?? 1;
    return {
      name: v.name,
      email: v.email,
      eventsCount,
      checkedIn: v.checkedIn,
      returning: eventsCount >= 2,
    };
  });
  list.sort((a, b) => Number(b.checkedIn) - Number(a.checkedIn) || a.name.localeCompare(b.name, "sv"));

  const attendees = list.length;
  const returning = list.filter((a) => a.returning).length;
  const checkedIn = list.filter((a) => a.checkedIn).length;
  const revenue = eventBookings.reduce((s, b) => s + (b.amount_paid || 0), 0);
  const capacity = listing.max_guests ?? null;

  // "No-show" only means something once the event is over — before then, nobody
  // has had the chance to check in, so every attendee would falsely count as a
  // no-show. Derive the end instant (Stockholm end-time if set, else end of the
  // event day) and only expose no-shows / check-in-rate after it has passed.
  const endLocal = listing.event_date
    ? `${listing.event_date}T${listing.event_end_time || "23:59"}`
    : null;
  const endIso = stockholmLocalToUtcISO(endLocal);
  const eventEnded = endIso ? new Date(endIso).getTime() < Date.now() : false;

  return NextResponse.json({
    event: { id: listing.id, title: listing.title, capacity, eventDate: listing.event_date ?? null },
    bookings: eventBookings.length,
    attendees,
    checkedIn,
    returning,
    new: attendees - returning,
    eventEnded,
    noShows: eventEnded ? attendees - checkedIn : null,
    checkInRate: eventEnded && attendees > 0 ? Math.round((checkedIn / attendees) * 100) : null,
    revenue,
    fillRate: capacity ? Math.round((attendees / capacity) * 100) : null,
    list,
  });
}
