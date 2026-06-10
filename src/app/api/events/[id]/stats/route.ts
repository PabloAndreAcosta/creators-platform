import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { attendeeKey, attendeeName, bookingEmail, attachProfiles, type BookingLike } from "@/lib/attendees";

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

  const { data: listing } = await supabase
    .from("listings")
    .select("id, title, max_guests, user_id, event_date")
    .eq("id", eventId)
    .single();
  if (!listing || listing.user_id !== user.id) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // All of the host's attendee bookings (RLS: creator_id = me). Used both for
  // this event's list and to detect repeat attendees across events.
  const { data: all } = await supabase
    .from("bookings")
    .select("id, listing_id, customer_id, guest_name, guest_email, checked_in_at, created_at, status, amount_paid")
    .eq("creator_id", user.id)
    .in("status", ["confirmed", "completed"]);

  const allBookings = await attachProfiles(createAdminClient(), (all ?? []) as unknown as BookingLike[]);

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

  return NextResponse.json({
    event: { id: listing.id, title: listing.title, capacity, eventDate: listing.event_date ?? null },
    bookings: eventBookings.length,
    attendees,
    checkedIn,
    returning,
    new: attendees - returning,
    noShows: attendees - checkedIn,
    checkInRate: attendees > 0 ? Math.round((checkedIn / attendees) * 100) : 0,
    revenue,
    fillRate: capacity ? Math.round((attendees / capacity) * 100) : null,
    list,
  });
}
