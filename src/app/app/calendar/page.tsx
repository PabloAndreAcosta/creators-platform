import { createClient } from "@/lib/supabase/server";
import { CalendarContent } from "./calendar-content";
import { CalendarSync } from "./calendar-sync";

export default async function CalendarPage() {
  let bookings: any[] = [];
  let feedUrl: string | null = null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const [{ data: bookingData }, { data: profile }] = await Promise.all([
        supabase
          .from("bookings")
          .select("id, scheduled_at, status, listings(title)")
          .or(`creator_id.eq.${user.id},customer_id.eq.${user.id}`)
          .in("status", ["pending", "confirmed"])
          .order("scheduled_at", { ascending: true }),
        supabase
          .from("profiles")
          .select("calendar_sync_token")
          .eq("id", user.id)
          .single(),
      ]);

      bookings = bookingData || [];

      if ((profile as any)?.calendar_sync_token) {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://usha.se";
        feedUrl = `${baseUrl}/api/calendar/feed?token=${(profile as any).calendar_sync_token}`;
      }
    }
  } catch {
    // Continue with empty data
  }

  return (
    <div className="px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold">Kalender</h1>
      <CalendarSync initialFeedUrl={feedUrl} />
      <CalendarContent bookings={bookings} />
    </div>
  );
}
