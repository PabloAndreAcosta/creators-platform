import { getServerTranslator, type Translate } from "@/lib/i18n/server";
import type { Locale } from "@/i18n/config";

export const EMAIL_NS = "emails";

/** Everything an email template needs to write in the reader's language. */
export interface EmailIntl {
  t: Translate;
  locale: Locale;
}

export async function getEmailIntl(locale: Locale): Promise<EmailIntl> {
  return { t: await getServerTranslator(EMAIL_NS, locale), locale };
}

/**
 * Regional formats for the three UI languages. Swedish and Spanish both want
 * day-before-month and a 24-hour clock; en-GB rather than en-US for the same
 * reason — the events are in Stockholm, and "3/4" must not read as March 4th.
 */
const INTL_LOCALE: Record<Locale, string> = {
  sv: "sv-SE",
  en: "en-GB",
  es: "es-ES",
};

const TZ = "Europe/Stockholm";

export function formatEmailDate(
  date: Date,
  locale: Locale,
  opts: Intl.DateTimeFormatOptions
): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: TZ, ...opts }).format(date);
}

/**
 * Amounts stay in Swedish grouping in every language: they are SEK payouts and
 * receipts against Swedish bookkeeping, and a reader comparing the mail to
 * their Stripe dashboard should see the same digits.
 */
export function formatSek(amount: number): string {
  return Math.round(amount).toLocaleString("sv-SE");
}
