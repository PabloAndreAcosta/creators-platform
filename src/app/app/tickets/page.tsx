import { createClient } from "@/lib/supabase/server";
import { TicketsContent } from "./tickets-content";

export default async function TicketsPage() {
  let bookings: any[] = [];

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data } = await supabase
        .from("bookings")
        .select("id, scheduled_at, status, notes, listings(title, category)")
        .eq("customer_id", user.id)
        .order("scheduled_at", { ascending: false });

      bookings = data || [];
    }
  } catch {
    // Continue with empty data
  }

  return <TicketsContent bookings={bookings} />;
}
