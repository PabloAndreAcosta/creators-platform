import { IntlErrorCode, type IntlError } from "next-intl";

/**
 * Shared next-intl error/fallback handlers used on both the server
 * (i18n/request.ts) and the client (components/intl-provider.tsx).
 *
 * Goal: a raw key like "categories.venue" must NEVER reach the UI. When a
 * message is missing we render a humanized version of the key's last segment
 * (e.g. "venue" → "Venue") and log a warning so the gap can be filled with a
 * real translation.
 */

function humanize(key: string): string {
  const last = key.split(".").pop() || key;
  return last
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export function getMessageFallback({
  key,
}: {
  error: IntlError;
  key: string;
  namespace?: string;
}): string {
  return humanize(key);
}

export function onIntlError(error: IntlError): void {
  if (error.code === IntlErrorCode.MISSING_MESSAGE) {
    // Expected-but-undesirable: a translation is missing. Warn, don't throw.
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[i18n] missing message: ${error.message}`);
    } else {
      // I produktion var det här HELT tyst: besökaren fick ett snällifierat
      // nyckelnamn och ingen fick veta. Sedan klientproviders bara bär sin egen
      // grupps namespace är ett saknat meddelande dessutom en rimlig signal på
      // att en lista i lib/i18n/client-namespaces har hamnat fel — den sortens
      // fel får inte upptäckas av en användare.
      reportMissingMessage(error);
    }
  } else {
    console.error("[i18n]", error);
  }
}

/**
 * Rapportera till Sentry utan att låta i18n bli beroende av att Sentry finns.
 * Import i funktionen: fallback.ts körs både på servern och i webbläsaren, och
 * en toppnivå-import skulle dra in Sentry i varje bundle som rör översättningar.
 */
function reportMissingMessage(error: IntlError): void {
  void import("@sentry/nextjs")
    .then((Sentry) => {
      Sentry.captureMessage(`[i18n] saknat meddelande: ${error.message}`, {
        level: "warning",
        tags: { area: "i18n", code: error.code },
      });
    })
    .catch(() => {
      // Sentry inte laddbart (t.ex. i ett test) — logga hellre än att tiga.
      console.warn(`[i18n] missing message: ${error.message}`);
    });
}
