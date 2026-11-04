import { createClient } from "@/lib/supabase/server";
import { sortEventsForOwner, todayInStockholm } from "@/lib/events/sort";
import { createAdminClient } from "@/lib/supabase/admin";
import { EventsContent, type PendingVolunteers } from "./events-content";
import { approvalScopeKey } from "@/lib/taxi/approvals";

export default async function EventsPage(
  props: {
    searchParams: Promise<{ fb_connected?: string; fb_error?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  let listings: any[] = [];
  let facebookPageId: string | null = null;
  let facebookPageName: string | null = null;
  let pendingVolunteers: PendingVolunteers[] = [];

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const admin = createAdminClient();
      // Kvällar den här användaren är med på. Tidigare togs bara can_manage
      // med, och följden var att en medkreatör med BARA statistikrätt aldrig
      // såg kvällen i listan — behörigheten fanns men gick inte att nå, för
      // det finns ingen annan väg in till statistiken än via den här fliken.
      // Se lib/listings/stats-access.ts, som redan skiljer "full" från
      // "numbers"; här var det bara navigationen som saknades.
      const { data: coRows } = await admin
        .from("listing_collaborators")
        .select("listing_id, can_manage, can_view_stats")
        .eq("user_id", user.id)
        .eq("status", "accepted")
        .or("can_manage.eq.true,can_view_stats.eq.true");
      const coIds = (coRows ?? []).map((r) => r.listing_id);
      // Den som bara får läsa siffror ska inte erbjudas redigera, sälja i
      // dörren eller se bokningar — knappar som ändå nekas är värre än inga.
      const endastStatistik = new Set(
        (coRows ?? []).filter((r) => !r.can_manage).map((r) => r.listing_id)
      );

      const [listingsRes, coRes, profileRes] = await Promise.all([
        supabase
          .from("listings")
          .select("*")
          .eq("user_id", user.id)
          .eq("from_gig", false)
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
      const co = (coRes.data || [])
        .filter((l) => !ownIds.has(l.id))
        .map((l) => ({ ...l, co_organized: true, stats_only: endastStatistik.has(l.id) }));

      // Kronologiskt, inte efter skapandetid. En serie skapas i en klump med
      // nästan identiska tidsstämplar, så åtta måndagar hamnade i praktiken i
      // slumpmässig ordning. Nästa kväll ska ligga överst.
      const today = todayInStockholm();
      listings = [...sortEventsForOwner(own, today), ...sortEventsForOwner(co, today)];
      // Väntande volontäransökningar i de egna kvällarnas avgränsningar (serie
      // eller arrangör). Volontärpass ligger annars bara i kvällens ⋯-meny.
      const upcomingOwn = sortEventsForOwner(own, today).filter((l) => l.event_date && l.event_date >= today);
      const scopeToListing = new Map<string, { id: string; title: string }>();
      for (const l of upcomingOwn) {
        const key = approvalScopeKey({ series_id: l.series_id ?? null, user_id: l.user_id });
        if (!scopeToListing.has(key)) scopeToListing.set(key, { id: l.id, title: l.title });
      }
      if (scopeToListing.size) {
        const { data: pend } = await admin
          .from("volunteer_approvals")
          .select("scope_key")
          .eq("status", "pending")
          .in("scope_key", [...scopeToListing.keys()]);
        const counts = new Map<string, number>();
        for (const r of pend ?? []) counts.set(r.scope_key, (counts.get(r.scope_key) ?? 0) + 1);
        pendingVolunteers = [...counts.entries()].map(([key, n]) => ({ n, ...scopeToListing.get(key)! }));
      }
      facebookPageId = profileRes.data?.facebook_page_id ?? null;
      facebookPageName = profileRes.data?.facebook_page_name ?? null;
    }
  } catch {
    // Continue with empty data
  }

  return (
    <EventsContent
      listings={listings}
      pendingVolunteers={pendingVolunteers}
      facebookPageId={facebookPageId}
      facebookPageName={facebookPageName}
      fbConnected={searchParams.fb_connected === "1"}
      fbError={searchParams.fb_error}
    />
  );
}
