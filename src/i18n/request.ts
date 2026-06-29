import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { defaultLocale, locales, LOCALE_COOKIE_NAME, type Locale } from './config';
import { getMessageFallback, onIntlError } from './fallback';

export default getRequestConfig(async ({ requestLocale }) => {
  // An explicitly requested locale (e.g. getTranslations({ locale }) for a
  // per-event language override) wins; otherwise fall back to the visitor's
  // cookie, then the platform default. Without this, explicit-locale calls
  // would silently get the cookie locale's messages.
  const requested = await requestLocale;
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;

  const locale: Locale = locales.includes(requested as Locale)
    ? (requested as Locale)
    : locales.includes(cookieLocale as Locale)
      ? (cookieLocale as Locale)
      : defaultLocale;

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
    // Never render a raw "namespace.key" to users; humanize + warn instead.
    getMessageFallback,
    onError: onIntlError,
  };
});
