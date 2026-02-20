import type { Metadata, Viewport } from "next";
import { ToastProvider } from "@/components/ui/toaster";
import Script from "next/script";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sv" className="dark">
      <body className="grain min-h-screen bg-[var(--usha-black)] text-[var(--usha-white)] antialiased">
        <ToastProvider>{children}</ToastProvider>
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
