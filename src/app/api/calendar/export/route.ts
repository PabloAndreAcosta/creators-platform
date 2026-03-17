import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { generateIcalFeed } from "@/lib/calendar/ical";

/**
 * Authenticated one-time .ics export (download file).
 * GET /api/calendar/export
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Ej inloggad" }, { status: 401 });
  }

  const { data: bookings } = await supabase
    .from("bookings")
    .select(
      "id, scheduled_at, status, notes, listing_id, creator_id, customer_id, listings(title, duration_minutes)"
    )
    .or(`creator_id.eq.${user.id},customer_id.eq.${user.id}`)
    .in("status", ["pending", "confirmed"])
    .order("scheduled_at", { ascending: true });

  if (!bookings || bookings.length === 0) {
    return new Response(generateIcalFeed([]), {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="usha-bokningar.ics"',
      },
    });
  }

  const userIds = new Set<string>();
  for (const b of bookings) {
    userIds.add(b.creator_id);
    userIds.add(b.customer_id);
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", Array.from(userIds));

  const nameMap = new Map<string, string>();
  for (const p of profiles || []) {
    if (p.full_name) nameMap.set(p.id, p.full_name);
  }

  const events = bookings.map((b) => {
    const listing = b.listings as unknown as { title: string; duration_minutes: number | null } | null;
    return {
      id: b.id,
      scheduled_at: b.scheduled_at,
      status: b.status as "pending" | "confirmed" | "completed" | "canceled",
      notes: b.notes,
      listing_title: listing?.title || "Bokning",
      duration_minutes: listing?.duration_minutes || null,
      creator_name: nameMap.get(b.creator_id) || null,
      customer_name: nameMap.get(b.customer_id) || null,
      is_creator: b.creator_id === user.id,
    };
  });

  const ical = generateIcalFeed(events);

  return new Response(ical, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="usha-bokningar.ics"',
    },
  });
}
