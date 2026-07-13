export const locales = ['sv', 'en', 'es'] as const;
export type Locale = (typeof locales)[number];
// Kept for metadata/SSG helpers that need a single canonical locale. Live
// visitor language is resolved per request (cookie → device → English), see
// detectLocaleFromAcceptLanguage + request.ts.
export const defaultLocale: Locale = 'sv';
// Cookie name was bumped once to ignore stale 'NEXT_LOCALE' values; new choices
// persist here.
export const LOCALE_COOKIE_NAME = 'usha-locale';

// Cookieless visitors follow their device's language when we support it
// (sv/en/es), otherwise English — never Swedish-by-default. Parses an
// Accept-Language header by descending q-value, matching the primary subtag
// ("sv-SE" → "sv").
export function detectLocaleFromAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return 'en';
  const ranked = header
    .split(',')
    .map((part) => {
      const [tag, q] = part.trim().split(';q=');
      return { primary: tag.trim().toLowerCase().split('-')[0], q: q ? parseFloat(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { primary } of ranked) {
    if (locales.includes(primary as Locale)) return primary as Locale;
  }
  return 'en';
}
