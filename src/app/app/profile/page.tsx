import { createClient } from "@/lib/supabase/server";
import { ProfileContent } from "./profile-content";

export default async function ProfilePage() {
  let profile = null;
  let email = "";
  let listingsCount = 0;
  let bookingsCount = 0;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      email = user.email || "";
      const [profileRes, listingsRes, bookingsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase
          .from("listings")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id),
        supabase
          .from("bookings")
          .select("*", { count: "exact", head: true })
          .or(`creator_id.eq.${user.id},customer_id.eq.${user.id}`),
      ]);
      profile = profileRes.data;
      listingsCount = listingsRes.count ?? 0;
      bookingsCount = bookingsRes.count ?? 0;
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
    />
  );
}
