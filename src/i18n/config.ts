export const locales = ['sv', 'en', 'es'] as const;
export type Locale = (typeof locales)[number];
// Kept for metadata/SSG helpers that need a single canonical locale. Live
// visitor language is resolved per request (cookie → device → English), see
// detectLocaleFromAcceptLanguage + request.ts.
export const defaultLocale: Locale = 'sv';
// Cookie name was bumped once to ignore stale 'NEXT_LOCALE' values; new choices
// persist here.
export const LOCALE_COOKIE_NAME = 'usha-locale';

// Search-engine crawlers / link-preview bots. When they don't specify a
// supported language we index this .se site as Swedish (its canonical language),
// while real visitors fall back to English — hence the per-caller `fallback`.
const BOT_UA = /bot|crawler|spider|crawling|googlebot|bingbot|slurp|duckduckbot|baiduspider|yandex|sogou|exabot|facebot|facebookexternalhit|twitterbot|linkedinbot|embedly|quora link preview|pinterest|slackbot|vkshare|w3c_validator|whatsapp|telegrambot|discordbot|applebot|petalbot|semrushbot|ahrefsbot/i;
export function isLikelyBot(userAgent: string | null | undefined): boolean {
  return !!userAgent && BOT_UA.test(userAgent);
}

// Cookieless visitors follow their device's language when we support it
// (sv/en/es); when nothing matches we use `fallback` (English for real visitors,
// Swedish for crawlers — never Swedish-by-default for humans). Parses an
// Accept-Language header by descending q-value, matching the primary subtag
// ("sv-SE" → "sv").
export function detectLocaleFromAcceptLanguage(
  header: string | null | undefined,
  fallback: Locale = 'en'
): Locale {
  if (!header) return fallback;
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
  return fallback;
}
