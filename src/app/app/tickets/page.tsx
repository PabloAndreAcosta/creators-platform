import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TicketsContent } from "./tickets-content";

const BOOKING_SELECT =
  "id, scheduled_at, status, notes, amount_paid, stripe_payment_id, is_free, booking_type, creator_id, listings(title, category, price, listing_type, image_url, event_date, event_time, event_location)";

export default async function TicketsPage() {
  let bookings: any[] = [];

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      // Own bookings (RLS-scoped to this user).
      const { data: own } = await supabase
        .from("bookings")
        .select(BOOKING_SELECT)
        .eq("customer_id", user.id)
        .order("scheduled_at", { ascending: false });

      // Guest bookings made with this user's email BEFORE they had an account.
      // These have customer_id = null, so RLS hides them from the user client —
      // fetch them narrowly by exact email via the admin client and merge.
      let guest: any[] = [];
      if (user.email) {
        const { data } = await createAdminClient()
          .from("bookings")
          .select(BOOKING_SELECT)
          .is("customer_id", null)
          .eq("guest_email", user.email)
          .order("scheduled_at", { ascending: false });
        guest = data || [];
      }

      // Merge + dedupe by id (a person may have both a guest and an account row).
      const byId = new Map<string, any>();
      for (const b of [...(own || []), ...guest]) byId.set(b.id, b);
      const merged = Array.from(byId.values());

      // Fetch creator info for each unique creator
      const creatorIds = Array.from(new Set(merged.map((b: any) => b.creator_id).filter(Boolean)));
      const { data: creators } = creatorIds.length
        ? await supabase
            .from("profiles")
            .select("id, full_name, avatar_url")
            .in("id", creatorIds)
        : { data: [] };

      const creatorMap = new Map((creators || []).map((c: any) => [c.id, c]));

      // Enrich bookings with creator info
      bookings = merged.map((b: any) => ({
        ...b,
        creator: creatorMap.get(b.creator_id) || null,
      }));
    }
  } catch {
    // Continue with empty data
  }

  return <TicketsContent bookings={bookings} />;
}
