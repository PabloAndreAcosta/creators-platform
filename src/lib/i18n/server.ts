import { createTranslator } from "next-intl";
import { defaultLocale, type Locale } from "@/i18n/config";

// Server-side translation loader for contexts without request (webhooks, cron, etc.)
// For request-aware contexts, use next-intl's getTranslations instead.

type Messages = Record<string, Record<string, string>>;

const messageCache = new Map<Locale, Messages>();

async function loadMessages(locale: Locale): Promise<Messages> {
  if (messageCache.has(locale)) return messageCache.get(locale)!;
  const messages = (await import(`@/i18n/messages/${locale}.json`)).default;
  messageCache.set(locale, messages);
  return messages;
}

export type TranslationParams = Record<string, string | number>;

/** Same shape as next-intl's `t`, so one renderer can serve server and browser. */
export interface Translate {
  (key: string, params?: TranslationParams): string;
  has(key: string): boolean;
}

/**
 * A translator for one namespace, for code that renders several messages at
 * once (a notification's title and body) and shouldn't re-await the message
 * bundle for each. Goes through next-intl's own formatter rather than a
 * hand-rolled `{key}` replace so a string behaves identically here and in the
 * browser — plurals in particular ("1 biljett" vs "2 biljetter") only work
 * through ICU, and the same key is rendered on both sides.
 */
export async function getServerTranslator(
  namespace: string,
  locale: Locale = defaultLocale
): Promise<Translate> {
  const messages = await loadMessages(locale);
  const t = createTranslator({ locale, messages, namespace, onError: () => {} });

  // Missing keys resolve to the key itself, so a typo shows up as a visible
  // key instead of throwing inside a webhook.
  const translate = ((key: string, params?: TranslationParams) => {
    if (messages[namespace]?.[key] == null) return key;
    const rendered = t(key as never, params as never) as unknown as string;
    return typeof rendered === "string" ? rendered : key;
  }) as Translate;
  translate.has = (key: string) => messages[namespace]?.[key] != null;
  return translate;
}

/** Renders a single message. */
export async function getServerTranslation(
  namespace: string,
  key: string,
  locale: Locale = defaultLocale,
  params?: TranslationParams
): Promise<string> {
  const t = await getServerTranslator(namespace, locale);
  return t(key, params);
}
