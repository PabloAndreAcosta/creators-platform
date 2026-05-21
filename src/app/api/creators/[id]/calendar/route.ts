import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildEventsCalendarIcs } from "@/lib/email/ics";

function isUUID(str: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

// Public subscribable calendar feed of a creator's upcoming events.
// Unauthenticated (no cookies) -> anon -> RLS limits to is_public creators
// and is_active listings.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const column = isUUID(params.id) ? "id" : "slug";

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq(column, params.id)
    .eq("is_public", true)
    .single();

  if (!profile) {
    return new Response("Not found", { status: 404 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: listings } = await supabase
    .from("listings")
    .select("id, title, event_date, event_time, event_location, description")
    .eq("user_id", profile.id)
    .eq("is_active", true)
    .eq("listing_type", "event")
    .gte("event_date", today)
    .order("event_date", { ascending: true });

  const ics = buildEventsCalendarIcs(
    `${profile.full_name || "Kreatör"} – Usha`,
    (listings ?? []).map((l) => ({
      uid: `event-${l.id}@usha.se`,
      title: l.title || "Event",
      dateStr: l.event_date,
      timeStr: l.event_time,
      location: l.event_location,
      description: l.description,
    }))
  );

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="usha-kalender.ics"',
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
