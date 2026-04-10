import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  req: NextRequest,
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

  // Verify this event belongs to the user
  const { data: listing } = await supabase
    .from("listings")
    .select("id, title, event_date, event_time, event_end_time, event_location, max_guests, user_id, price")
    .eq("id", eventId)
    .single();

  if (!listing || listing.user_id !== user.id) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Get all bookings for this event
  const { data: bookings } = await supabase
    .from("bookings")
    .select(
      "id, status, checked_in_at, guest_count, amount_paid, guest_name, guest_email, customer_id, created_at, profiles!bookings_customer_id_fkey(full_name, email)"
    )
    .eq("listing_id", eventId)
    .in("status", ["confirmed", "completed"]);

  const allBookings = bookings ?? [];

  // Calculate stats
  const totalTickets = allBookings.length;
  const totalGuests = allBookings.reduce((sum, b) => sum + (b.guest_count || 1), 0);
  const checkedIn = allBookings.filter((b) => b.checked_in_at).length;
  const checkedInGuests = allBookings
    .filter((b) => b.checked_in_at)
    .reduce((sum, b) => sum + (b.guest_count || 1), 0);
  const totalRevenue = allBookings.reduce((sum, b) => sum + (b.amount_paid || 0), 0);
  const checkInRate = totalTickets > 0 ? Math.round((checkedIn / totalTickets) * 100) : 0;

  // Recent check-ins (last 5)
  const recentCheckIns = allBookings
    .filter((b) => b.checked_in_at)
    .sort((a, b) => new Date(b.checked_in_at!).getTime() - new Date(a.checked_in_at!).getTime())
    .slice(0, 5)
    .map((b) => ({
      id: b.id,
      name: (b as any).profiles?.full_name || b.guest_name || "Guest",
      checkedInAt: b.checked_in_at,
      guestCount: b.guest_count || 1,
    }));

  // Guest list
  const guestList = allBookings.map((b) => ({
    id: b.id,
    name: (b as any).profiles?.full_name || b.guest_name || "Guest",
    email: (b as any).profiles?.email || b.guest_email || null,
    guestCount: b.guest_count || 1,
    checkedIn: !!b.checked_in_at,
    checkedInAt: b.checked_in_at,
    amountPaid: b.amount_paid || 0,
    bookedAt: b.created_at,
  }));

  return NextResponse.json({
    event: {
      id: listing.id,
      title: listing.title,
      date: listing.event_date,
      time: listing.event_time,
      endTime: listing.event_end_time,
      location: listing.event_location,
      capacity: listing.max_guests,
      price: listing.price,
    },
    stats: {
      totalTickets,
      totalGuests,
      checkedIn,
      checkedInGuests,
      totalRevenue,
      checkInRate,
      capacity: listing.max_guests,
    },
    recentCheckIns,
    guestList,
  });
}
