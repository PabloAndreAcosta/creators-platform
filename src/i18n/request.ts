import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import { locales, LOCALE_COOKIE_NAME, detectLocaleFromAcceptLanguage, isLikelyBot, type Locale } from './config';
import { getMessageFallback, onIntlError } from './fallback';

export default getRequestConfig(async ({ requestLocale }) => {
  // An explicitly requested locale (e.g. getTranslations({ locale }) for a
  // per-event language override) wins; then the visitor's saved cookie; then we
  // detect the device language (English fallback), never Swedish-by-default.
  const requested = await requestLocale;
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  const h = await headers();
  // Crawlers with no supported language get Swedish (the .se site's canonical
  // language, for indexing); real visitors get English.
  const fallback: Locale = isLikelyBot(h.get('user-agent')) ? 'sv' : 'en';

  const locale: Locale = locales.includes(requested as Locale)
    ? (requested as Locale)
    : locales.includes(cookieLocale as Locale)
      ? (cookieLocale as Locale)
      : detectLocaleFromAcceptLanguage(h.get('accept-language'), fallback);

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
    // Never render a raw "namespace.key" to users; humanize + warn instead.
    getMessageFallback,
    onError: onIntlError,
  };
});
