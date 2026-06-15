import { createClient } from "@/lib/supabase/server";
import { CalendarContent } from "./calendar-content";
import { CalendarSync } from "./calendar-sync";
import { FollowedEvents, type FollowedEvent } from "./followed-events";

export default async function CalendarPage() {
  let bookings: any[] = [];
  let feedUrl: string | null = null;
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
      const lastDayNum = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const endOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDayNum).padStart(2, "0")}`;

      const [{ data: bookingData }, { data: profile }, { data: availabilityData }] = await Promise.all([
        supabase
          .from("bookings")
          .select("id, scheduled_at, status, listings(title)")
          .or(`creator_id.eq.${user.id},customer_id.eq.${user.id}`)
          .in("status", ["pending", "confirmed"])
          .order("scheduled_at", { ascending: true }),
        supabase
          .from("profiles")
          .select("calendar_sync_token, role")
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
      availableDates = (availabilityData || []).map((r) => r.available_date);
      isCreator = profile?.role === "creator" || profile?.role === "venue" || profile?.role === "creator" || profile?.role === "venue";

      if ((profile as any)?.calendar_sync_token) {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://usha.se";
        feedUrl = `${baseUrl}/api/calendar/feed?token=${(profile as any).calendar_sync_token}`;
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
  } catch {
    // Continue with empty data
  }

  return (
    <div className="px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold">Kalender</h1>
      <CalendarSync initialFeedUrl={feedUrl} />
      <CalendarContent bookings={bookings} initialAvailableDates={availableDates} isCreator={isCreator} />
      <FollowedEvents events={followedEvents} />
    </div>
  );
}
