import type { Page } from "@playwright/test";

// Samlar fel som bara syns i webbläsaren.
//
// React rapporterar hydreringsproblem som minifierade felkoder i produktion
// (#418 textmismatch, #423/#425 trädmismatch) och som utskrivna varningar i
// dev. Vi fångar båda formerna, plus obehandlade undantag.

const HYDRATION_PATTERN =
  /hydrat|did not match|server rendered|Minified React error #(418|419|420|421|422|423|424|425)/i;

export interface CollectedErrors {
  hydration: string[];
  errors: string[];
}

/**
 * Börjar lyssna på sidans konsol. Anropa FÖRE page.goto, annars missas allt
 * som händer under laddningen.
 */
export function collectConsole(page: Page): CollectedErrors {
  const collected: CollectedErrors = { hydration: [], errors: [] };

  page.on("console", (message) => {
    const text = message.text();
    if (HYDRATION_PATTERN.test(text)) {
      collected.hydration.push(text);
    } else if (message.type() === "error") {
      collected.errors.push(text);
    }
  });

  page.on("pageerror", (error) => {
    const text = String(error?.message ?? error);
    if (HYDRATION_PATTERN.test(text)) collected.hydration.push(text);
    else collected.errors.push(text);
  });

  return collected;
}

/**
 * Fel som inte är värda att fälla ett test på: brus från tillägg, blockerade
 * tredjepartsanrop och nätverksfel utanför appens kontroll.
 */
export function meaningfulErrors(collected: CollectedErrors): string[] {
  return collected.errors.filter(
    (text) =>
      !/chrome-extension|ERR_BLOCKED_BY_CLIENT|net::ERR_|Failed to load resource|googletagmanager|google-analytics|vercel-insights|sentry/i.test(
        text
      )
  );
}
