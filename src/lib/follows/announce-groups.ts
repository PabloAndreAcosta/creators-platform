/**
 * Följarmejlet, ett per serie.
 *
 * Mejlkörningen hämtar varje nypublicerad kväll som en egen rad. En serie med
 * åtta kvällar gav därför varje följare åtta mejl i samma körning. Här slås
 * raderna ihop: kvällar i samma serie (series_id) hos samma avsändare blir ett
 * utskick, fristående kvällar förblir ett var.
 *
 * Avsändaren är den följaren följer: arrangören i första omgången, lokalen i
 * den andra. Nyckeln tar med den så att två arrangörer som råkar dela serie-id
 * aldrig slås ihop.
 */

export interface AnnounceListing {
  id: string;
  user_id: string;
  title: string | null;
  event_date: string | null;
  event_location: string | null;
  series_id?: string | null;
  series_slug?: string | null;
  venue_profile_id?: string | null;
}

export interface AnnounceGroup<L extends AnnounceListing = AnnounceListing> {
  key: string;
  /** Kvällarna i datumordning, odaterade sist. */
  listings: L[];
  /** Den första kvällen: titel, plats och datum i mejlet kommer härifrån. */
  first: L;
  /** Antal kvällar i utskicket. 1 = fristående kväll. */
  count: number;
}

function byDate(a: AnnounceListing, b: AnnounceListing): number {
  if (a.event_date && b.event_date) return a.event_date.localeCompare(b.event_date);
  if (a.event_date) return -1;
  if (b.event_date) return 1;
  return 0;
}

/**
 * Grupperar kvällar per (avsändare, serie). `senderOf` säger vem utskicket
 * kommer ifrån — `user_id` för arrangörens följare, `venue_profile_id` för
 * lokalens.
 */
export function groupForAnnouncement<L extends AnnounceListing>(
  listings: readonly L[],
  senderOf: (l: L) => string | null | undefined = (l) => l.user_id
): AnnounceGroup<L>[] {
  const groups = new Map<string, L[]>();
  for (const l of listings) {
    const sender = senderOf(l) ?? "";
    const key = l.series_id ? `${sender}:series:${l.series_id}` : `${sender}:listing:${l.id}`;
    const list = groups.get(key);
    if (list) list.push(l);
    else groups.set(key, [l]);
  }
  return [...groups.entries()].map(([key, list]) => {
    const sorted = [...list].sort(byDate);
    return { key, listings: sorted, first: sorted[0], count: sorted.length };
  });
}

/**
 * Länken i mejlet. En serie med egen sida länkar dit, annars första kvällen.
 * Bara när utskicket faktiskt gäller flera kvällar — en ensam kväll i en serie
 * ska till sin egen sida, där biljetten finns.
 */
export function announcementUrl(group: AnnounceGroup, appUrl: string): string {
  if (group.count > 1 && group.first.series_slug) {
    return `${appUrl}/series/${encodeURIComponent(group.first.series_slug)}`;
  }
  return `${appUrl}/listing/${group.first.id}`;
}
