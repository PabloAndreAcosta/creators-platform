import { useTranslations } from "next-intl";
import { ArrowRight, Ticket } from "lucide-react";

type Ns = "forCreators" | "forVenues" | "forAudience";

/** Shared hero for the three perspective pages: H1 + value sub + ONE primary
 *  CTA, copy driven by the page's namespace. `wedge` shows a subtle reassurance
 *  line under the CTA (used on the audience page for the no-account ticket
 *  wedge) — clearly lighter weight than the primary button. */
export function PerspectiveHero({ ns, ctaHref, wedge }: { ns: Ns; ctaHref: string; wedge?: boolean }) {
  const t = useTranslations(ns);

  return (
    <section className="relative flex min-h-[70vh] flex-col items-center justify-center overflow-hidden px-4 pb-12 pt-24 sm:px-6">
      <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="h-[500px] w-[800px] rounded-full bg-[var(--usha-gold)] opacity-[0.05] blur-[180px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-3xl text-center">
        <h1 className="mb-6 text-3xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
          {t("hero.h1")}
        </h1>
        <p className="mx-auto mb-10 max-w-2xl text-base leading-relaxed text-[var(--usha-muted)] sm:text-lg">
          {t("hero.sub")}
        </p>
        <a
          href={ctaHref}
          className="glow-gold inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-8 py-4 text-base font-bold text-black transition hover:scale-[1.02] hover:opacity-90"
        >
          {t("hero.cta")}
          <ArrowRight size={16} />
        </a>

        {wedge && (
          <p className="mt-4 inline-flex items-center justify-center gap-1.5 text-sm text-[var(--usha-muted)]">
            <Ticket size={14} className="text-[#5ce0d2]" />
            {t("wedge")}
          </p>
        )}
      </div>
    </section>
  );
}
