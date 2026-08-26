import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CalendarContent } from "./calendar-content";
import { CalendarSync } from "./calendar-sync";
import { FollowedEvents, type FollowedEvent } from "./followed-events";

export default async function CalendarPage() {
  let bookings: any[] = [];
  let feedUrl: string | null = null;
  let lastFetchedAt: string | null = null;
  let lastClient: string | null = null;
  let availableDates: string[] = [];
  let isCreator = false;
  let followedEvents: FollowedEvent[] = [];

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const now = new Date();
      const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString();
      const lastDayNum = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const endOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDayNum).padStart(2, "0")}`;

      // calendar_sync_token is no longer readable by the authenticated role
      // (revoked so a logged-in user can't read other users' feed tokens); read
      // the user's OWN row via service-role after the getUser() ownership check.
      const admin = createAdminClient();
      const [{ data: bookingData }, { data: profile }, { data: availabilityData }] = await Promise.all([
        // Hämtar ett halvår bakåt och framåt: kalenderrutnätet ska gå att
        // bläddra i historiskt, så filtret på "kommande" hör hemma i listan och
        // inte här. Utan någon gräns alls växer frågan obegränsat med tiden.
        supabase
          .from("bookings")
          .select("id, scheduled_at, status, guest_name, customer_id, listings(title)")
          .or(`creator_id.eq.${user.id},customer_id.eq.${user.id}`)
          .in("status", ["pending", "confirmed"])
          .gte("scheduled_at", sixMonthsAgo)
          .order("scheduled_at", { ascending: true })
          .limit(500),
        admin
          .from("profiles")
          .select("calendar_sync_token, role, calendar_feed_last_fetched_at, calendar_feed_last_client")
          .eq("id", user.id)
          .single(),
        supabase
          .from("creator_availability")
          .select("available_date")
          .eq("user_id", user.id)
          .gte("available_date", startOfMonth)
          .lte("available_date", endOfMonth),
      ]);

      bookings = bookingData || [];

      // Tio identiska rader är tio olika kunder som bokat samma pass. Utan namn
      // går de inte att skilja åt, vilket fick listan att se ut som dubbletter.
      const customerIds = Array.from(
        new Set((bookings as { customer_id?: string | null }[]).map((b) => b.customer_id).filter(Boolean))
      ) as string[];

      if (customerIds.length) {
        const { data: customers } = await admin
          .from("profiles")
          .select("id, full_name")
          .in("id", customerIds);
        const nameById = new Map((customers || []).map((c) => [c.id, c.full_name]));
        bookings = (bookings as any[]).map((b) => ({
          ...b,
          bookerName: b.guest_name || nameById.get(b.customer_id) || null,
        }));
      } else {
        bookings = (bookings as any[]).map((b) => ({ ...b, bookerName: b.guest_name || null }));
      }
      availableDates = (availabilityData || []).map((r) => r.available_date);
      isCreator = profile?.role === "creator" || profile?.role === "venue" || profile?.role === "creator" || profile?.role === "venue";

      if ((profile as any)?.calendar_sync_token) {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://usha.se";
        feedUrl = `${baseUrl}/api/calendar/feed?token=${(profile as any).calendar_sync_token}`;
        lastFetchedAt = (profile as any).calendar_feed_last_fetched_at ?? null;
        lastClient = (profile as any).calendar_feed_last_client ?? null;
      }

      // Aggregated upcoming events from creators the user follows.
      const today = new Date().toISOString().slice(0, 10);
      const { data: follows } = await supabase
        .from("follows")
        .select("followed_id")
        .eq("follower_id", user.id);
      const followedIds = (follows || []).map((f) => f.followed_id);

      if (followedIds.length) {
        const { data: evs } = await supabase
          .from("listings")
          .select("id, title, event_date, event_time, event_location, user_id")
          .in("user_id", followedIds)
          .eq("is_active", true)
          .eq("listing_type", "event")
          .gte("event_date", today)
          .order("event_date", { ascending: true })
          .limit(50);

        if (evs?.length) {
          const creatorIds = Array.from(new Set(evs.map((e) => e.user_id)));
          const { data: creators } = await supabase
            .from("profiles")
            .select("id, full_name, avatar_url, slug")
            .in("id", creatorIds);
          const cmap = new Map((creators || []).map((c) => [c.id, c]));
          followedEvents = evs.map((e) => {
            const c = cmap.get(e.user_id) as { full_name?: string; avatar_url?: string | null; slug?: string | null } | undefined;
            return {
              id: e.id,
              title: e.title || "Event",
              eventDate: e.event_date,
              eventTime: e.event_time,
              location: e.event_location,
              creatorName: c?.full_name || "Kreatör",
              creatorAvatar: c?.avatar_url ?? null,
              creatorHandle: c?.slug || e.user_id,
            };
          });
        }
      }
    }
  } catch (error) {
    // Rendering with empty data beats a crashed page, but swallowing the reason
    // silently made a real failure indistinguishable from "nothing configured":
    // a calendar sync that IS active would show as disconnected with no trace to
    // debug. Log it so the cause is visible in the platform logs.
    console.error("[calendar] kunde inte ladda sidans data:", error);
  }

  return (
    <div className="px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold">Kalender</h1>
      <CalendarSync initialFeedUrl={feedUrl} lastFetchedAt={lastFetchedAt} lastClient={lastClient} />
      <CalendarContent bookings={bookings} initialAvailableDates={availableDates} isCreator={isCreator} />
      <FollowedEvents events={followedEvents} />
    </div>
  );
}
