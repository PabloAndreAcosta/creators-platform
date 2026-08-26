import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { generateIcalFeed } from "@/lib/calendar/ical";

/**
 * Grov gissning av vilken kalender som hämtar flödet, utifrån User-Agent.
 * Klienterna identifierar sig inte formellt, så det här är en tolkning och inte
 * ett faktum — därför presenteras den i gränssnittet som "hämtad av", inte
 * "kopplad till".
 */
function guessCalendarClient(ua: string | null): string {
  if (!ua) return "other";
  const s = ua.toLowerCase();
  if (s.includes("google")) return "google";
  if (s.includes("outlook") || s.includes("microsoft")) return "outlook";
  // Apples kalender hämtar via dataaccessd på macOS och iOS.
  if (s.includes("dataaccessd") || s.includes("ios/") || s.includes("mac os x")) return "apple";
  return "other";
}


/**
 * Public iCal feed endpoint. Authenticated via calendar_sync_token query param.
 * Subscribe to this URL from Google Calendar, Apple Calendar, Outlook, etc.
 *
 * GET /api/calendar/feed?token=<calendar_sync_token>
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 401 });
  }

  // Use service-level client since this is a public endpoint (no user session)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { get: () => undefined, set: () => {}, remove: () => {} } }
  );

  // Look up user by sync token
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("calendar_sync_token", token)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const userId = profile.id;

  // Notera vem som hämtade flödet. Det är den enda ärliga signalen på att
  // synken faktiskt fungerar: appen kan inte veta vilken kalender som
  // prenumererar, bara vem som hämtar. Körs utan await — en misslyckad
  // notering får aldrig hindra att kalendern levereras.
  void supabase
    .from("profiles")
    .update({
      calendar_feed_last_fetched_at: new Date().toISOString(),
      calendar_feed_last_client: guessCalendarClient(request.headers.get("user-agent")),
    })
    .eq("id", userId)
    .then(() => {});

  // Fetch bookings with related data
  const { data: bookings } = await supabase
    .from("bookings")
    .select(
      "id, scheduled_at, status, notes, listing_id, creator_id, customer_id, listings(title, duration_minutes)"
    )
    .or(`creator_id.eq.${userId},customer_id.eq.${userId}`)
    .in("status", ["pending", "confirmed"])
    .order("scheduled_at", { ascending: true });

  if (!bookings) {
    return new Response(generateIcalFeed([]), {
      headers: icalHeaders(),
    });
  }

  // Collect unique user IDs for name lookup
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
      is_creator: b.creator_id === userId,
    };
  });

  const ical = generateIcalFeed(events);

  return new Response(ical, {
    headers: icalHeaders(),
  });
}

function icalHeaders(): HeadersInit {
  return {
    "Content-Type": "text/calendar; charset=utf-8",
    "Content-Disposition": 'inline; filename="usha-bokningar.ics"',
    "Cache-Control": "no-cache, no-store, must-revalidate",
  };
}
