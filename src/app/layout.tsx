import type { Metadata, Viewport } from "next";
import { getLocale, getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { ToastProvider } from "@/components/ui/toaster";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import Script from "next/script";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#D4AF37",
};

export const metadata: Metadata = {
  title: "Usha Platform – Marketplace för Creators",
  description: "Hitta och boka kreativa talanger. Dansinstruktörer, musiker, fotografer och mer.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Usha",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
  openGraph: {
    title: "Usha Platform",
    description: "Marketplace för Creators",
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className="dark">
      <body className="grain min-h-screen bg-[var(--usha-black)] text-[var(--usha-white)] antialiased" suppressHydrationWarning>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ConnectionStatus />
          <ToastProvider>{children}</ToastProvider>
        </NextIntlClientProvider>
        <Script id="sw-register" strategy="afterInteractive">{`
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
              .then(function(reg) { console.log('[SW] Registered:', reg.scope) })
              .catch(function(err) { console.log('[SW] Failed:', err) })
          }
        `}</Script>
      </body>
    </html>
  );
}
