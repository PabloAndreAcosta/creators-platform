export const locales = ['sv', 'en', 'es'] as const;
export type Locale = (typeof locales)[number];
// Swedish-first: usha.se is a Swedish platform (.se, BankID, Swedish audience)
// and the landing metadata is Swedish. Cookieless visitors and crawlers must
// see Swedish content with <html lang="sv"> so the page is indexed and shared
// correctly. English stays available via the language switcher (sets a cookie).
export const defaultLocale: Locale = 'sv';
// Cookie name was bumped once to ignore stale 'NEXT_LOCALE' values; new choices
// persist here.
export const LOCALE_COOKIE_NAME = 'usha-locale';
