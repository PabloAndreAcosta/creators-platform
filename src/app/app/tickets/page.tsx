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
        .select("id, scheduled_at, status, notes, amount_paid, booking_type, creator_id, listings(title, category, image_url, event_date, event_time, event_location)")
        .eq("customer_id", user.id)
        .order("scheduled_at", { ascending: false });

      // Fetch creator info for each unique creator
      const creatorIds = Array.from(new Set((data || []).map((b: any) => b.creator_id).filter(Boolean)));
      const { data: creators } = creatorIds.length
        ? await supabase
            .from("profiles")
            .select("id, full_name, avatar_url")
            .in("id", creatorIds)
        : { data: [] };

      const creatorMap = new Map((creators || []).map((c: any) => [c.id, c]));

      // Enrich bookings with creator info
      bookings = (data || []).map((b: any) => ({
        ...b,
        creator: creatorMap.get(b.creator_id) || null,
      }));
    }
  } catch {
    // Continue with empty data
  }

  return <TicketsContent bookings={bookings} />;
}
