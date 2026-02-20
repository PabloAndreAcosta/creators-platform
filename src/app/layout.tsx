import type { Metadata, Viewport } from "next";
import { ToastProvider } from "@/components/ui/toaster";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "Usha Platform – Marketplace för Creators",
  description: "Hitta och boka kreativa talanger. Dansinstruktörer, musiker, fotografer och mer.",
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
      </body>
    </html>
  );
}
