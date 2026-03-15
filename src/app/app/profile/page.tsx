import { createClient } from "@/lib/supabase/server";
import { ProfileContent } from "./profile-content";

export default async function ProfilePage() {
  let profile = null;
  let email = "";
  let listingsCount = 0;
  let bookingsCount = 0;
  let favoritesCount = 0;
  let averageRating: number | null = null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      email = user.email || "";
      const [profileRes, listingsRes, bookingsRes, favoritesRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase
          .from("listings")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id),
        supabase
          .from("bookings")
          .select("*", { count: "exact", head: true })
          .or(`creator_id.eq.${user.id},customer_id.eq.${user.id}`),
        supabase
          .from("favorites")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id),
      ]);
      profile = profileRes.data;
      listingsCount = listingsRes.count ?? 0;
      bookingsCount = bookingsRes.count ?? 0;
      favoritesCount = favoritesRes.count ?? 0;

      // Fetch average rating for this user (as creator)
      const { data: reviewsData } = await supabase
        .from("reviews")
        .select("rating")
        .eq("creator_id", user.id);
      const ratings = (reviewsData || []).map((r) => r.rating);
      if (ratings.length > 0) {
        averageRating = Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10;
      }
    }
  } catch {
    // Continue with defaults
  }

  return (
    <ProfileContent
      profile={profile}
      email={email}
      listingsCount={listingsCount}
      bookingsCount={bookingsCount}
      favoritesCount={favoritesCount}
      averageRating={averageRating}
    />
  );
}
