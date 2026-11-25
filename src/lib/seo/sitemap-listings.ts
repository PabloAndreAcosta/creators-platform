/**
 * Vilka aktiva annonser sitemapen får ta med.
 *
 * Sitemapen tog med varje aktiv, publik annons. Men /listing/[id] (tjänster
 * och klippkort, utan datum) kräver också att säljarens profil går att läsa —
 * RLS släpper bara igenom profiler med is_public = true — annars svarar sidan
 * 404. Två sådana adresser låg i sitemapen och gav 404 i Search Console.
 *
 * Daterade evenemang (/event/[slug]) visas oavsett om värdens profil är dold,
 * så där gäller bara is_active/is_public, som frågan redan filtrerar på.
 */
export function filterSitemapListings<T extends { event_date: string | null; user_id: string }>(
  listings: T[],
  publicOwnerIds: ReadonlySet<string>
): T[] {
  return listings.filter((l) => !!l.event_date || publicOwnerIds.has(l.user_id));
}
