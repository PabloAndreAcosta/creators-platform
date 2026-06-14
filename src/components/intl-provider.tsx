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
      getMessageFallback={getMessageFallback}
      onError={onIntlError}
    >
      {children}
    </NextIntlClientProvider>
  );
}
