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
    }
  } else {
    console.error("[i18n]", error);
  }
}
