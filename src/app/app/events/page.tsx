import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EventsContent } from "./events-content";

export default async function EventsPage(
  props: {
    searchParams: Promise<{ fb_connected?: string; fb_error?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  let listings: any[] = [];
  let facebookPageId: string | null = null;
  let facebookPageName: string | null = null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const admin = createAdminClient();
      // Events this user co-organizes (accepted can_manage collaborator) — shown
      // alongside their own so they can administer them from the Events tab.
      const { data: coRows } = await admin
        .from("listing_collaborators")
        .select("listing_id")
        .eq("user_id", user.id)
        .eq("status", "accepted")
        .eq("can_manage", true);
      const coIds = (coRows ?? []).map((r) => r.listing_id);

      const [listingsRes, coRes, profileRes] = await Promise.all([
        supabase
          .from("listings")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        coIds.length
          ? admin.from("listings").select("*").in("id", coIds).order("created_at", { ascending: false })
          : Promise.resolve({ data: [] as any[] }),
        supabase
          .from("profiles")
          .select("facebook_page_id, facebook_page_name")
          .eq("id", user.id)
          .single(),
      ]);

      // Own events first, then co-organized (deduped in case of overlap).
      const own = listingsRes.data || [];
      const ownIds = new Set(own.map((l) => l.id));
      const co = (coRes.data || []).filter((l) => !ownIds.has(l.id)).map((l) => ({ ...l, co_organized: true }));
      listings = [...own, ...co];
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
