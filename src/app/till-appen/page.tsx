import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { safeAppReturnPath } from "@/lib/native-return";
import { HandOff } from "./hand-off";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Hit skickar Stripe köparen när kortkassan öppnats från Android-/iOS-appen
 * (se src/lib/native-return.ts). Sidan visas i webbläsarfliken, inte i appen,
 * och lämnar direkt över till appen via usha://. Knappen finns för de fall
 * webbläsaren kräver ett tryck innan den öppnar en annan app.
 */
export default async function TillAppenPage({
  searchParams,
}: {
  searchParams: Promise<{ till?: string }>;
}) {
  const { till } = await searchParams;
  const path = safeAppReturnPath(till);
  const t = await getTranslations("nativeReturn");
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-xl font-bold">{t("title")}</h1>
        <p className="mt-2 text-sm text-[var(--usha-muted)]">{t("body")}</p>
        <HandOff href={`usha://${path}`} label={t("button")} />
      </div>
    </main>
  );
}
