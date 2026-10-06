export const dynamic = 'force-dynamic';

import { getLocale, getMessages } from "next-intl/server";
import { IntlProvider } from "@/components/intl-provider";
import { pickMessages, AUTH_NAMESPACES } from "@/lib/i18n/client-namespaces";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // Egen provider för den här delen: en nästlad NextIntlClientProvider
  // ERSÄTTER förälderns messages, den slår inte ihop dem. Rotlayouten bär bara
  // de publika sidornas namespace, så den här grenen måste bära sina egna.
  const messages = pickMessages(await getMessages(), AUTH_NAMESPACES);

  return (
    <IntlProvider locale={await getLocale()} messages={messages}>
      {children}
    </IntlProvider>
  );
}
