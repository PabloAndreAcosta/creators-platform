import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("privacy");
  return {
    title: `${t("title")} – Usha Platform`,
    description: "Så behandlar Usha AB dina personuppgifter enligt GDPR.",
    alternates: { canonical: "/privacy" },
  };
}

function List({ items }: { items: string }) {
  return (
    <ul className="list-disc space-y-2 pl-6">
      {items.split("\n").filter(Boolean).map((li) => (
        <li key={li}>{li}</li>
      ))}
    </ul>
  );
}

export default async function PrivacyPage() {
  const t = await getTranslations("privacy");
  const locale = await getLocale();
  const disclaimer = locale !== "sv" ? t("disclaimer") : "";
  const h2 = "mb-3 text-lg font-semibold text-[var(--usha-white)]";

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
          <section>
            <h2 className={h2}>{t("s1Title")}</h2>
            <p>{t("s1Body")}</p>
          </section>
          <section>
            <h2 className={h2}>{t("s2Title")}</h2>
            <List items={t("s2Items")} />
          </section>
          <section>
            <h2 className={h2}>{t("s3Title")}</h2>
            <List items={t("s3Items")} />
          </section>
          <section>
            <h2 className={h2}>{t("s4Title")}</h2>
            <p>{t("s4Body")}</p>
          </section>
          <section>
            <h2 className={h2}>{t("s5Title")}</h2>
            <p>{t("s5Body")}</p>
          </section>
          <section>
            <h2 className={h2}>{t("s6Title")}</h2>
            <p>{t("s6Body")}</p>
          </section>
          <section>
            <h2 className={h2}>{t("s7Title")}</h2>
            <p>{t("s7Intro")}</p>
            <div className="mt-2">
              <List items={t("s7Items")} />
            </div>
          </section>
          <section>
            <h2 className={h2}>{t("s8Title")}</h2>
            <p>{t("s8Body")}</p>
          </section>
          <section>
            <h2 className={h2}>{t("s9Title")}</h2>
            <p>
              {t("s9BodyPre")}
              <a href={`mailto:${t("s9Email")}`} className="text-[var(--usha-gold)] hover:underline">
                {t("s9Email")}
              </a>
            </p>
            <p className="mt-2">{t("s9BodyPost")}</p>
          </section>
        </div>
      </div>
    </main>
  );
}
