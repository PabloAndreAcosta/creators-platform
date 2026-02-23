import { createClient } from "@/lib/supabase/server";
import { HomeContent } from "./home-content";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  website: string | null;
  category: string | null;
  location: string | null;
  hourly_rate: number | null;
  is_public: boolean;
  tier: string | null;
  stripe_account_id: string | null;
  created_at: string;
  updated_at: string;
}

interface Listing {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: string;
  price: number | null;
  duration_minutes: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

type TopCreator = Pick<Profile, "id" | "full_name" | "category" | "avatar_url">;

export default async function AppHomePage() {
  let profile: Profile | null = null;
  let listings: Listing[] = [];
  let topCreators: TopCreator[] = [];
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
      profile = profileRes.data as Profile | null;
      listings = (listingsRes.data || []) as Listing[];
      bookingsCount = bookingsRes.count ?? 0;

      const { data: creators } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, category, hourly_rate")
        .eq("is_public", true)
        .limit(8);
      topCreators = (creators || []) as TopCreator[];
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
