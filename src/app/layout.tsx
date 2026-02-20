import type { Metadata, Viewport } from "next";
import { ToastProvider } from "@/components/ui/toaster";
import { ServiceWorkerRegistrar } from "@/components/service-worker-registrar";
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
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
