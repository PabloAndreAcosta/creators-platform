import { createClient } from "@/lib/supabase/server";
import { CalendarContent } from "./calendar-content";
import { CalendarSync } from "./calendar-sync";

export default async function CalendarPage() {
  let bookings: any[] = [];
  let feedUrl: string | null = null;
  let availableDates: string[] = [];
  let isCreator = false;

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
      isCreator = profile?.role === "creator" || profile?.role === "experience" || profile?.role === "kreator" || profile?.role === "upplevelse";

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
      <CalendarContent bookings={bookings} initialAvailableDates={availableDates} isCreator={isCreator} />
    </div>
  );
}
