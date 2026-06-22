import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { getLocale, getMessages } from "next-intl/server";
import { IntlProvider } from "@/components/intl-provider";
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
  title: "Usha Platform — Skapa event, sälj biljetter, betala ditt crew",
  description:
    "Plattformen för kreatörer och upplevelser: skapa event på minuter, sälj biljetter, skanna vid dörren och betala ditt crew — tryggt med BankID och Stripe.",
  // NOTE: manifest + apple-touch-icon are declared manually in <head> (see
  // RootLayout) because metadata-API tags render into <body> in production,
  // which breaks PWA installability. Do not re-add `manifest` here.
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Usha Platform",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  icons: {
    icon: [
      { url: "/icon-192.png" },
      { url: "/icon-light-192.png", media: "(prefers-color-scheme: light)" },
    ],
    // apple-touch-icon is declared manually in <head> (see RootLayout) so it
    // lands in <head> rather than <body> in production streaming.
  },
  openGraph: {
    title: "Usha Platform — Skapa event, sälj biljetter, betala ditt crew",
    description:
      "Skapa event, sälj biljetter, skanna vid dörren och betala ditt crew — allt i en app.",
    type: "website",
    locale: "sv_SE",
    url: "https://usha.se",
    siteName: "Usha Platform",
  },
  twitter: {
    card: "summary_large_image",
    title: "Usha Platform — Skapa event, sälj biljetter, betala ditt crew",
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
        {/* PWA tags are declared explicitly here instead of via the Next.js
            metadata API: in production streaming, metadata-generated tags render
            into <body>, and React does NOT hoist <link rel="manifest"> to <head>.
            Chrome only reads a manifest linked from <head>, so a body-placed link
            makes the app non-installable (no install icon, no beforeinstallprompt).
            Elements inside this manual <head> are reliably emitted in <head>. */}
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
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
        <IntlProvider locale={locale} messages={messages}>
          <ConnectionStatus />
          <ToastProvider>{children}</ToastProvider>
        </IntlProvider>
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
