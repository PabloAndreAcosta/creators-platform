import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { getLocale, getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { ToastProvider } from "@/components/ui/toaster";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { GoogleAnalytics } from "@/components/google-analytics";
import { Analytics as VercelAnalytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Script from "next/script";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#D4AF37",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://usha.se"),
  title: "Usch-Ja! — Skapa event, sälj biljetter, betala ditt crew",
  description:
    "Plattformen för kreatörer och upplevelser: skapa event på minuter, sälj biljetter, skanna vid dörren och betala ditt crew — tryggt med BankID och Stripe.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Usch-Ja!",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  icons: {
    icon: [
      { url: "/icon-192.png" },
      { url: "/icon-light-192.png", media: "(prefers-color-scheme: light)" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Usch-Ja! — Skapa event, sälj biljetter, betala ditt crew",
    description:
      "Skapa event, sälj biljetter, skanna vid dörren och betala ditt crew — allt i en app.",
    type: "website",
    locale: "sv_SE",
    url: "https://usha.se",
    siteName: "Usch-Ja!",
  },
  twitter: {
    card: "summary_large_image",
    title: "Usch-Ja! — Skapa event, sälj biljetter, betala ditt crew",
    description:
      "Skapa event, sälj biljetter, skanna vid dörren och betala ditt crew — allt i en app.",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get("usha-theme")?.value;
  const themeClass = themeCookie === "light" ? "" : "dark";

  return (
    <html lang={locale} className={themeClass} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            try {
              var t = localStorage.getItem('usha-theme');
              if (!t) t = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
              if (t === 'light') {
                document.documentElement.classList.remove('dark');
              } else {
                document.documentElement.classList.add('dark');
              }
            } catch(e) {
              document.documentElement.classList.add('dark');
            }
          })();
        `}} />
      </head>
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
        <GoogleAnalytics />
        <VercelAnalytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
