import { createClient } from "@/lib/supabase/server";
import { HomeContent } from "./home-content";

export default async function AppHomePage() {
  let profile = null;
  let listings: any[] = [];
  let topCreators: any[] = [];
  let bookingsCount = 0;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const [profileRes, listingsRes, bookingsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase
          .from("listings")
          .select("*, profiles(full_name, avatar_url)")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(6),
        supabase
          .from("bookings")
          .select("*", { count: "exact", head: true })
          .eq("creator_id", user.id)
          .in("status", ["pending", "confirmed"]),
      ]);
      profile = profileRes.data;
      listings = listingsRes.data || [];
      bookingsCount = bookingsRes.count ?? 0;

      const { data: creators } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, category, hourly_rate")
        .eq("is_public", true)
        .limit(8);
      topCreators = creators || [];
    }
  } catch {
    // Continue with mock data
  }

  return (
    <HomeContent
      profile={profile}
      listings={listings}
      topCreators={topCreators}
      bookingsCount={bookingsCount}
    />
  );
}
