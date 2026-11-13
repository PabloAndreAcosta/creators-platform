import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Scale, Check, Minus } from "lucide-react";
import { SiteNav } from "@/components/landing/site-nav";
import { Footer } from "@/components/landing/footer";
import { safeJsonLd } from "@/lib/json-ld";

/**
 * Usha jämfört med Tickster och Billetto, öppet och med källor.
 *
 * Tanken är lånad från hur andra plattformar vågar ställa sig bredvid
 * konkurrenterna: den som jämför ska slippa göra jobbet själv. Priset är att
 * allt om de andra måste komma från deras egna publika sidor, med datum,
 * och att vi säger lika tydligt när Usha inte passar. Raderna om Tickster
 * och Billetto är avskrivna från deras prissidor och villkor den dag som står
 * i sidfoten — ändrar de något ska raden ändras, inte försvaras.
 *
 * Texten bor i namespace "compare". Källänkarna ligger här i koden, för en
 * adress översätts inte.
 */

const SOURCES: { key: "tickster" | "billetto"; urls: string[] }[] = [
  { key: "tickster", urls: ["https://about.tickster.com/pricing/", "https://support.tickster.com/hc/sv/articles/4416695059474"] },
  { key: "billetto", urls: ["https://go.billetto.com/sv-se/pricing", "https://support.billetto.com/sv/hc/articles/115001201325"] },
];

const ROWS = ["buyerFee", "organiserFee", "freeEvents", "monthly", "payment", "payout", "door", "kiosk", "passes", "venueShare", "bankid", "marketing", "fitFor"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("compare");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { canonical: "/jamfor" },
    openGraph: {
      title: t("ogTitle"),
      description: t("metaDescription"),
      url: "https://usha.se/jamfor",
      type: "website",
      siteName: "Usha Platform",
    },
  };
}

export default async function ComparePage() {
  const t = await getTranslations("compare");

  const faq = [1, 2, 3, 4].map((n) => ({ q: t(`faq${n}Q`), a: t(`faq${n}A`) }));
  const fits = [1, 2, 3, 4].map((n) => t(`fit${n}`));
  const notFits = [1, 2, 3, 4].map((n) => t(`notFit${n}`));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <main className="bg-[var(--usha-black)] text-[var(--usha-white)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
      <SiteNav />

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-6 pt-24 pb-10 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--usha-gold)]/30 bg-[var(--usha-gold)]/10 px-3 py-1 text-xs font-medium text-[var(--usha-gold)]">
          <Scale size={13} /> {t("badge")}
        </span>
        <h1 className="mt-5 text-4xl font-bold leading-tight sm:text-5xl">{t("heroTitle")}</h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-[var(--usha-muted)]">{t("heroBody")}</p>
      </section>

      {/* Table */}
      <section className="mx-auto max-w-4xl px-6 py-6">
        <div className="overflow-x-auto rounded-2xl border border-[var(--usha-border)]">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-[var(--usha-border)] bg-[var(--usha-card)]">
                <th className="w-[22%] px-4 py-3 text-left font-medium text-[var(--usha-muted)]"></th>
                <th className="w-[26%] px-4 py-3 text-left font-semibold text-[var(--usha-gold)]">Usha</th>
                <th className="w-[26%] px-4 py-3 text-left font-medium text-[var(--usha-white)]">Tickster</th>
                <th className="w-[26%] px-4 py-3 text-left font-medium text-[var(--usha-white)]">Billetto</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, i) => (
                <tr key={row} className={`align-top ${i % 2 ? "bg-[var(--usha-card)]/40" : ""}`}>
                  <td className="px-4 py-3 font-medium text-[var(--usha-muted)]">{t(`row.${row}.label`)}</td>
                  <td className="px-4 py-3 text-[var(--usha-white)]">{t(`row.${row}.usha`)}</td>
                  <td className="px-4 py-3 text-[var(--usha-muted)]">{t(`row.${row}.tickster`)}</td>
                  <td className="px-4 py-3 text-[var(--usha-muted)]">{t(`row.${row}.billetto`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-center text-xs text-[var(--usha-muted)]">{t("tableNote", { date: t("checkedDate") })}</p>
      </section>

      {/* Fit / not fit */}
      <section className="mx-auto max-w-4xl px-6 py-10">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-[var(--usha-gold)]/30 bg-gradient-to-b from-[var(--usha-gold)]/10 to-transparent p-6">
            <h2 className="text-lg font-semibold">{t("fitTitle")}</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {fits.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--usha-gold)]" />
                  <span className="text-[var(--usha-muted)]">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6">
            <h2 className="text-lg font-semibold">{t("notFitTitle")}</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {notFits.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Minus className="mt-0.5 h-4 w-4 shrink-0 text-[var(--usha-muted)]" />
                  <span className="text-[var(--usha-muted)]">{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-[var(--usha-muted)]">{t("notFitFootnote")}</p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-6 py-10">
        <h2 className="mb-5 text-center text-2xl font-bold">{t("faqTitle")}</h2>
        <div className="divide-y divide-[var(--usha-border)] rounded-2xl border border-[var(--usha-border)]">
          {faq.map((f) => (
            <div key={f.q} className="px-5 py-4">
              <h3 className="text-sm font-semibold">{f.q}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--usha-muted)]">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Sources */}
      <section className="mx-auto max-w-3xl px-6 py-6">
        <h2 className="text-sm font-semibold text-[var(--usha-muted)]">{t("sourcesTitle")}</h2>
        <p className="mt-1 text-xs leading-relaxed text-[var(--usha-muted)]">{t("sourcesBody", { date: t("checkedDate") })}</p>
        <ul className="mt-3 space-y-1 text-xs">
          {SOURCES.map((s) => (
            <li key={s.key} className="text-[var(--usha-muted)]">
              <span className="font-medium text-[var(--usha-white)]">{t(`sources.${s.key}`)}:</span>{" "}
              {s.urls.map((u, i) => (
                <span key={u}>
                  {i > 0 && " · "}
                  <a href={u} target="_blank" rel="noopener noreferrer" className="underline decoration-[var(--usha-border)] underline-offset-2 hover:text-[var(--usha-gold)]">
                    {u.replace(/^https?:\/\/(www\.)?/, "")}
                  </a>
                </span>
              ))}
            </li>
          ))}
        </ul>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-3xl px-6 py-14 text-center">
        <h2 className="text-2xl font-bold">{t("ctaTitle")}</h2>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-[var(--usha-muted)]">{t("ctaBody")}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--usha-gold)] px-5 py-3 text-sm font-semibold text-[var(--usha-black)] transition hover:opacity-90"
          >
            {t("ctaPrimary")} <ArrowRight size={16} />
          </Link>
          <Link
            href="/salj-biljetter"
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--usha-border)] px-5 py-3 text-sm font-medium text-[var(--usha-white)] transition hover:border-[var(--usha-gold)]/40"
          >
            {t("ctaSecondary")}
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}
