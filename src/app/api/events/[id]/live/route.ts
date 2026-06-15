import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { capabilitiesEnforced } from "@/lib/capabilities/flag";
import { hasCapability } from "@/lib/capabilities/access";
import { EVENT_PACK, UNLOCK_COSTS } from "@/lib/capabilities/config";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

  const admin = createAdminClient();

  // Capability gate — only blocks once enforcement is flipped on (open during
  // beta). Live dashboard needs the event pack (tier-granted or token-unlocked).
  if (await capabilitiesEnforced()) {
    const allowed = await hasCapability(admin, user.id, "live", eventId);
    if (!allowed) {
      return NextResponse.json(
        { error: "capability_required", capability: EVENT_PACK, cost: UNLOCK_COSTS[EVENT_PACK] },
        { status: 402 }
      );
    }
  }

  // Get all bookings for this event
  const { data: bookings } = await supabase
    .from("bookings")
    .select(
      "id, status, checked_in_at, scanned_by, guest_count, amount_paid, guest_name, guest_email, customer_id, created_at"
    )
    .eq("listing_id", eventId)
    .in("status", ["confirmed", "completed"]);

  const allBookings = bookings ?? [];

  // Resolve booking customers' names (customer_id → auth.users, so we look up
  // profiles separately rather than via an embed).
  const custIds = Array.from(
    new Set(allBookings.map((b) => b.customer_id).filter((x): x is string => !!x))
  );
  const custById = new Map<string, { full_name: string | null; email: string | null }>();
  if (custIds.length) {
    const { data: custProfiles } = await admin
      .from("profiles")
      .select("id, full_name, email")
      .in("id", custIds);
    for (const p of custProfiles ?? []) custById.set(p.id, { full_name: p.full_name, email: p.email });
  }

  // Resolve who checked each guest in (host or a delegated crew member).
  const scannerIds = Array.from(
    new Set(allBookings.map((b) => (b as { scanned_by?: string }).scanned_by).filter(Boolean))
  ) as string[];
  const scannerNames = new Map<string, string>();
  if (scannerIds.length) {
    const { data: scanners } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", scannerIds);
    for (const s of scanners ?? []) scannerNames.set(s.id, s.full_name ?? "");
  }

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
      name: custById.get(b.customer_id ?? "")?.full_name || b.guest_name || "Guest",
      checkedInAt: b.checked_in_at,
      guestCount: b.guest_count || 1,
      scannedBy: (b as { scanned_by?: string }).scanned_by
        ? scannerNames.get((b as { scanned_by?: string }).scanned_by!) || null
        : null,
    }));

  // Guest list
  const guestList = allBookings.map((b) => ({
    id: b.id,
    name: custById.get(b.customer_id ?? "")?.full_name || b.guest_name || "Guest",
    email: custById.get(b.customer_id ?? "")?.email || b.guest_email || null,
    guestCount: b.guest_count || 1,
    checkedIn: !!b.checked_in_at,
    checkedInAt: b.checked_in_at,
    amountPaid: b.amount_paid || 0,
    bookedAt: b.created_at,
  }));

    return NextResponse.json(
      {
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
      },
      // Per-event guest PII — never cache in a shared/browser cache.
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Route error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
