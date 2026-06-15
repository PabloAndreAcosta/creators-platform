/**
 * Group listings that share a series_id so a series renders as one card.
 * Series are returned with their occurrences sorted by event_date (ascending);
 * standalone listings (no series_id) are returned separately. Used by every
 * surface that lists a creator's listings, so the grouping logic lives once.
 */
export function groupListingsBySeries<
  T extends { series_id?: string | null; event_date?: string | null }
>(listings: T[]): { series: T[][]; standalone: T[] } {
  const map = new Map<string, T[]>();
  const standalone: T[] = [];

  for (const l of listings) {
    if (l.series_id) {
      const g = map.get(l.series_id) ?? [];
      g.push(l);
      map.set(l.series_id, g);
    } else {
      standalone.push(l);
    }
  }

  const series = [...map.values()].map((g) =>
    [...g].sort((a, b) => (a.event_date || "").localeCompare(b.event_date || ""))
  );

  return { series, standalone };
}
