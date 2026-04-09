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

export async function getServerTranslation(
  namespace: string,
  key: string,
  locale: Locale = defaultLocale,
  params?: Record<string, string | number>
): Promise<string> {
  const messages = await loadMessages(locale);
  let text = messages[namespace]?.[key] ?? key;

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }

  return text;
}
