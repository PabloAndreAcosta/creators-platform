import { createAdminClient } from "@/lib/supabase/admin";
import { locales, type Locale } from "@/i18n/config";

/**
 * Transactional mail is composed away from the request that triggered it — a
 * nightly reminder, a Stripe webhook — so it can't read the visitor's cookie or
 * Accept-Language. The reader's own choice, remembered on their profile, is the
 * only thing available at that point.
 *
 * Falls back to English rather than Swedish: someone who never told us is
 * treated the way the app treats a visitor with no cookie, not as a Swede.
 */
export const EMAIL_FALLBACK_LOCALE: Locale = "en";

function asLocale(value: unknown): Locale | null {
  return typeof value === "string" && (locales as readonly string[]).includes(value)
    ? (value as Locale)
    : null;
}

/**
 * The language to write to this person in. `userId` is the reliable key;
 * `email` covers senders that only know an address (a guest booking, a
 * recipient looked up by contact address). A guest with no profile falls back.
 */
export async function resolveRecipientLocale(opts: {
  userId?: string | null;
  email?: string | null;
  /** Language of the surrounding context, e.g. an event with a forced language. */
  preferred?: string | null;
}): Promise<Locale> {
  const preferred = asLocale(opts.preferred);
  if (preferred) return preferred;

  try {
    const admin = createAdminClient();

    if (opts.userId) {
      const { data } = await admin
        .from("profiles")
        .select("locale")
        .eq("id", opts.userId)
        .maybeSingle();
      const found = asLocale(data?.locale);
      if (found) return found;
    }

    if (opts.email) {
      // Two addresses can reach one person (login vs. contact), so check both.
      // Separate eq() filters rather than one or() string: the address comes
      // from user input and would otherwise be spliced into PostgREST's filter
      // grammar, where a comma or paren changes what the query means.
      const address = opts.email.trim().toLowerCase();
      for (const column of ["email", "contact_email"] as const) {
        const { data } = await admin
          .from("profiles")
          .select("locale")
          .eq(column, address)
          .limit(1)
          .maybeSingle();
        const found = asLocale(data?.locale);
        if (found) return found;
      }
    }
  } catch (err) {
    // Never let a language lookup stop a receipt from going out.
    console.error("resolveRecipientLocale failed:", err);
  }

  return EMAIL_FALLBACK_LOCALE;
}
