import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("terms");
  return {
    title: `${t("title")} – Usha Platform`,
    description: "Användarvillkor för Usha Platform (usha.se).",
    alternates: { canonical: "/terms" },
  };
}

export default async function TermsPage() {
  const t = await getTranslations("terms");
  const locale = await getLocale();
  const disclaimer = locale !== "sv" ? t("disclaimer") : "";

  const sections = Array.from({ length: 9 }, (_, i) => ({
    title: t(`s${i + 1}Title`),
    body: t(`s${i + 1}Body`),
  }));

  return (
    <main className="min-h-screen bg-[var(--usha-black)] text-[var(--usha-white)]">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-[var(--usha-muted)] transition-colors hover:text-[var(--usha-white)]"
        >
          <ArrowLeft size={14} />
          {t("back")}
        </Link>

        <h1 className="mb-2 text-4xl font-bold">{t("title")}</h1>
        <p className="mb-4 text-sm text-[var(--usha-muted)]">{t("lastUpdated")}</p>

        {disclaimer && (
          <p className="mb-10 rounded-xl border border-[var(--usha-gold)]/30 bg-[var(--usha-gold)]/10 px-4 py-3 text-sm text-[var(--usha-gold)]">
            {disclaimer}
          </p>
        )}

        <div className="space-y-8 text-sm leading-relaxed text-[var(--usha-muted)]">
          {sections.map((s) => (
            <section key={s.title}>
              <h2 className="mb-3 text-lg font-semibold text-[var(--usha-white)]">{s.title}</h2>
              <p>{s.body}</p>
            </section>
          ))}

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--usha-white)]">{t("s10Title")}</h2>
            <p>
              {t("s10BodyPre")}
              <a href={`mailto:${t("s10Email")}`} className="text-[var(--usha-gold)] hover:underline">
                {t("s10Email")}
              </a>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
