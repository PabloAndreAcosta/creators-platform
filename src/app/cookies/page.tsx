import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = {
  title: "Cookiepolicy – Usha Platform",
  description: "Hur Usha Platform använder cookies.",
  alternates: { canonical: "/cookies" },
};

export default async function CookiesPage() {
  const t = await getTranslations("cookiesPage");
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

        <h1 className="mb-2 text-4xl font-bold">{t("heading")}</h1>
        <p className="mb-12 text-sm text-[var(--usha-muted)]">
          {t("lastUpdated")}
        </p>

        <div className="space-y-8 text-sm leading-relaxed text-[var(--usha-muted)]">
          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--usha-white)]">{t("whatHeading")}</h2>
            <p>
              {t("whatBody")}
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--usha-white)]">{t("whichHeading")}</h2>

            <h3 className="mt-4 mb-2 font-semibold text-[var(--usha-white)]">{t("necessaryHeading")}</h3>
            <p>
              {t("necessaryBody")}
            </p>
            <ul className="list-disc space-y-1 pl-6 mt-2">
              <li>{t("necessaryItem1")}</li>
              <li>{t("necessaryItem2")}</li>
            </ul>

            <h3 className="mt-4 mb-2 font-semibold text-[var(--usha-white)]">{t("functionalHeading")}</h3>
            <p>
              {t("functionalBody")}
            </p>

            <h3 className="mt-4 mb-2 font-semibold text-[var(--usha-white)]">{t("analyticsHeading")}</h3>
            <p>
              {t("analyticsBody")}
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--usha-white)]">{t("thirdPartyHeading")}</h2>
            <p>
              {t("thirdPartyBody")}
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--usha-white)]">{t("manageHeading")}</h2>
            <p>
              {t("manageBody")}
            </p>
            <p className="mt-2">
              {t("manageListIntro")}
            </p>
            <ul className="list-disc space-y-1 pl-6 mt-2">
              <li>{t("manageItem1")}</li>
              <li>{t("manageItem2")}</li>
              <li>{t("manageItem3")}</li>
              <li>{t("manageItem4")}</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--usha-white)]">{t("contactHeading")}</h2>
            <p>
              {t("contactBody")}{" "}
              <a href="mailto:privacy@usha.se" className="text-[var(--usha-gold)] hover:underline">
                privacy@usha.se
              </a>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
