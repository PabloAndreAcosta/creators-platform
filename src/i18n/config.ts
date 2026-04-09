export const locales = ['sv', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'sv';
export const LOCALE_COOKIE_NAME = 'NEXT_LOCALE';
