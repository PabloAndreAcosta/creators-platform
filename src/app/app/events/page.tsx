import { createClient } from "@/lib/supabase/server";
import { EventsContent } from "./events-content";

export default async function EventsPage() {
  let listings: any[] = [];

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data } = await supabase
        .from("listings")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      listings = data || [];
    }
  } catch {
    // Continue with empty data
  }

  return <EventsContent listings={listings} />;
}
