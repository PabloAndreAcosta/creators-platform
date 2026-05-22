export const locales = ['sv', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';
// Bumped from 'NEXT_LOCALE' to force every existing visitor back to the
// English default once; old cookies are ignored, new choices persist here.
export const LOCALE_COOKIE_NAME = 'usha-locale';
