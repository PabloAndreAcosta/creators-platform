import { createClient } from "@/lib/supabase/server";
import { CalendarContent } from "./calendar-content";

export default async function CalendarPage() {
  let bookings: any[] = [];

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data } = await supabase
        .from("bookings")
        .select("id, scheduled_at, status, listings(title)")
        .or(`creator_id.eq.${user.id},customer_id.eq.${user.id}`)
        .in("status", ["pending", "confirmed"])
        .order("scheduled_at", { ascending: true });

      bookings = data || [];
    }
  } catch {
    // Continue with empty data
  }

  return <CalendarContent bookings={bookings} />;
}
