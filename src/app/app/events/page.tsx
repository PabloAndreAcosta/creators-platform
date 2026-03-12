import { createClient } from "@/lib/supabase/server";
import { EventsContent } from "./events-content";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: { fb_connected?: string; fb_error?: string };
}) {
  let listings: any[] = [];
  let facebookPageId: string | null = null;
  let facebookPageName: string | null = null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const [listingsRes, profileRes] = await Promise.all([
        supabase
          .from("listings")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("facebook_page_id, facebook_page_name")
          .eq("id", user.id)
          .single(),
      ]);

      listings = listingsRes.data || [];
      facebookPageId = profileRes.data?.facebook_page_id ?? null;
      facebookPageName = profileRes.data?.facebook_page_name ?? null;
    }
  } catch {
    // Continue with empty data
  }

  return (
    <EventsContent
      listings={listings}
      facebookPageId={facebookPageId}
      facebookPageName={facebookPageName}
      fbConnected={searchParams.fb_connected === "1"}
      fbError={searchParams.fb_error}
    />
  );
}
