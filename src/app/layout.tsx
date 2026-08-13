import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
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

// og:locale wants a full language_TERRITORY tag, not the bare app locale.
const OG_LOCALE: Record<string, string> = { sv: "sv_SE", en: "en_US", es: "es_ES" };

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("meta");
  const title = t("siteTitle");
  const description = t("siteDescription");
  const ogDescription = t("siteOgDescription");

  return {
    metadataBase: new URL("https://usha.se"),
    title,
    description,
    // NOTE: manifest, apple-touch-icon and the apple/mobile web-app meta tags are
    // declared manually in <head> (see RootLayout) because metadata-API tags
    // render into <body> in production streaming, which breaks PWA installability
    // (Chrome) and the iOS "Add to Home Screen" standalone experience (Safari).
    // Do not re-add `manifest`, `appleWebApp` or `mobile-web-app-capable` here.
    icons: {
      icon: [
        { url: "/icon-192.png" },
        { url: "/icon-light-192.png", media: "(prefers-color-scheme: light)" },
      ],
      // apple-touch-icon is declared manually in <head> (see RootLayout) so it
      // lands in <head> rather than <body> in production streaming.
    },
    openGraph: {
      title,
      description: ogDescription,
      type: "website",
      locale: OG_LOCALE[locale] ?? "sv_SE",
      // Deliberately NO `url` here. Next.js overwrites (never merges) the
      // openGraph object per segment, so a root-level url would silently become
      // og:url on every page that doesn't declare its own openGraph block —
      // telling crawlers that /marketplace, /login etc. are the start page.
      // metadataBase + a per-page `url` is the correct pattern.
      siteName: "Usha Platform",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: ogDescription,
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get("usha-theme")?.value;
  // Light by default (cookieless). Only an explicit "dark" choice renders dark
  // server-side; the inline script below then follows the device's setting for
  // visitors who haven't chosen, so a dark-mode device still gets dark.
  const themeClass = themeCookie === "dark" ? "dark" : "";

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
        {/* iOS "Add to Home Screen" standalone hints — Safari only honors these
            from <head>. mobile-web-app-capable is the modern name; the apple-
            prefixed variant covers older iOS (<16.4) that ignore the manifest. */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Usha Platform" />
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            try {
              var t = localStorage.getItem('usha-theme');
              // No explicit choice → follow the device; default to LIGHT unless
              // the device is set to dark mode.
              if (!t) t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
              if (t === 'dark') {
                document.documentElement.classList.add('dark');
              } else {
                document.documentElement.classList.remove('dark');
              }
            } catch(e) {
              document.documentElement.classList.remove('dark');
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
