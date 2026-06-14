import { useTranslations } from "next-intl";
import { RefreshCw } from "lucide-react";

type Ns = "forCreators" | "forVenues" | "forAudience";

/** "How the cycle works for you" — the flywheel told from this audience's
 *  self-interest. Copy driven by the page's namespace. */
export function LoopSection({ ns }: { ns: Ns }) {
  const t = useTranslations(ns);

  return (
    <section className="relative py-16 px-4 sm:py-20 sm:px-6">
      <div className="mx-auto max-w-2xl rounded-2xl border border-[var(--usha-gold)]/20 bg-[var(--usha-card)] p-8 text-center sm:p-10">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--usha-gold)] to-[var(--usha-accent)]">
          <RefreshCw size={20} className="text-black" />
        </div>
        <h2 className="mb-3 text-xl font-bold tracking-tight sm:text-2xl">{t("loop.title")}</h2>
        <p className="leading-relaxed text-[var(--usha-muted)]">{t("loop.body")}</p>
      </div>
    </section>
  );
}
