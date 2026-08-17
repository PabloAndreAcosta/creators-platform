"use client";

import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import type { ReactNode } from "react";
import { getMessageFallback, onIntlError } from "@/i18n/fallback";

/**
 * Client wrapper for NextIntlClientProvider that attaches the shared
 * getMessageFallback/onError handlers. These are functions, so they can't be
 * passed as props from the (server) root layout — defining them inside this
 * client module keeps client components covered by the same "never show a raw
 * key" fallback as Server Components.
 */
/**
 * Tidszonen måste anges explicit. Utan den formaterar servern datum i sin egen
 * zon (UTC på Vercel) och webbläsaren i besökarens, så samma tidpunkt blir
 * olika text på de två sidorna — hydreringsmismatch, som next-intl varnar för
 * i loggen. Verksamheten är svensk och event anges i svensk tid.
 */
export const APP_TIME_ZONE = "Europe/Stockholm";

export function IntlProvider({
  locale,
  messages,
  children,
}: {
  locale: string;
  messages: AbstractIntlMessages;
  children: ReactNode;
}) {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      timeZone={APP_TIME_ZONE}
      getMessageFallback={getMessageFallback}
      onError={onIntlError}
    >
      {children}
    </NextIntlClientProvider>
  );
}
