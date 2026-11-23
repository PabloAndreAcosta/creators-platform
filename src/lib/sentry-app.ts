/**
 * Sentry i appskalet (Capacitor). Skalet laddar https://usha.se i en webbvy, så
 * webbens Sentry (instrumentation-client.ts) fångar redan felen där. Det som
 * saknades var att skilja dem från webbläsarens: felvakten på Hjärnan och den
 * som lagar ett fel behöver veta om det bara händer i appen.
 *
 * Taggarna sätts bara när Sentry ändå startas, alltså när NEXT_PUBLIC_SENTRY_DSN
 * finns. Inga personuppgifter: bara skal (app/webb) och plattform.
 *
 * Native krascher (Swift/Kotlin, utanför webbvyn) kräver @sentry/capacitor och
 * en ny butiksversion. Det är inte gjort här.
 */

type Fonster = {
  Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
  navigator?: { userAgent?: string };
};

/** Skalet lägger till "UshaPlatformApp" i user agent (capacitor.config.ts appendUserAgent). */
const SKAL_UA = /\bUshaPlatformApp\b/;

export function appSkalTaggar(w: Fonster | undefined): Record<string, string> {
  if (!w) return { skal: "server" };
  const cap = w.Capacitor;
  const plattform = cap?.isNativePlatform?.() ? cap.getPlatform?.() : undefined;
  if (plattform === "ios" || plattform === "android") return { skal: "app", plattform };
  if (SKAL_UA.test(w.navigator?.userAgent ?? "")) return { skal: "app", plattform: "okänd" };
  return { skal: "webb" };
}
