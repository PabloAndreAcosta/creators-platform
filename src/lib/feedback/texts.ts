/**
 * Texterna för felknappen och felsidorna.
 *
 * Komponenterna tar texterna som vanliga props i stället för att själva anropa
 * useTranslations. Skälet är global-error: den ersätter rotlayouten och har
 * ingen IntlProvider, så den läser static-texts.json direkt. Alla andra ytor
 * hämtar samma nycklar ur språkfilerna. Testet static-texts.test.ts håller de
 * två kopiorna lika.
 */
export const FEEDBACK_KEYS = [
  "button", "title", "label", "placeholder", "shareUser", "notice", "errorAttached",
  "send", "sending", "cancel", "close", "thanks", "failed", "empty",
  "shareShot", "shotHint", "shotWorking", "shotFailed", "shotAlt",
] as const;

export const ERROR_PAGE_KEYS = [
  "title", "fallback", "reloadFallback", "retry", "home", "toApp", "code", "report",
] as const;

export type FeedbackTexts = Record<(typeof FEEDBACK_KEYS)[number], string>;
/** "code" innehåller platshållaren {code}. */
export type ErrorPageTexts = Record<(typeof ERROR_PAGE_KEYS)[number], string>;

export type FeedbackLocale = "sv" | "en" | "es";

export function toFeedbackLocale(value: string | null | undefined): FeedbackLocale | undefined {
  const v = (value ?? "").toLowerCase().slice(0, 2);
  return v === "sv" || v === "en" || v === "es" ? v : undefined;
}

/**
 * Språk för global-error, som saknar next-intl: språkcookien först (samma som
 * resten av sajten), sedan enhetens språk, annars svenska.
 */
export function detectStaticLocale(cookie: string, languages: readonly string[]): FeedbackLocale {
  const m = /(?:^|;\s*)usha-locale=([^;]+)/.exec(cookie);
  const fromCookie = toFeedbackLocale(m ? decodeURIComponent(m[1]) : undefined);
  if (fromCookie) return fromCookie;
  for (const l of languages) {
    const hit = toFeedbackLocale(l);
    if (hit) return hit;
  }
  return "sv";
}

export function fillCode(template: string, code: string): string {
  return template.replace("{code}", code);
}
