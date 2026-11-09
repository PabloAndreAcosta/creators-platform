import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("securityPage");
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://usha.se";
  return {
    title: `${t("title")} – Usha Platform`,
    description: t("metaDescription"),
    alternates: { canonical: "/sakerhet" },
    openGraph: { title: `${t("title")} – Usha Platform`, description: t("metaDescription"), url: `${base}/sakerhet`, type: "website" },
  };
}

/**
 * usha.se/sakerhet — vårt Trust Center.
 *
 * Sidan en lokal, ett företag eller en partner läser innan de litar på oss:
 * hur vi skyddar konton och data, vilka leverantörer som rör personuppgifter
 * och var deras intyg finns, hur vi övervakar oss själva och hur man når oss
 * om något är fel. Innehållet speglar docs/sakerhet/ i repot; det som står
 * här ska gå att kontrollera där.
 */
export default async function SecurityPage() {
  const t = await getTranslations("securityPage");
  const h2 = "mb-3 text-lg font-semibold text-[var(--usha-white)]";
  const vendors = [
    ["Vercel", t("vendorVercel"), "EU/CDN", "SOC 2 Type II, ISO 27001:2022"],
    ["Supabase", t("vendorSupabase"), "Frankfurt (EU)", "SOC 2 Type II"],
    ["Stripe", t("vendorStripe"), "EU/USA", "PCI DSS 1, SOC 2"],
    ["Signicat", t("vendorSignicat"), "Norge/EU", "ISO 27001, eIDAS"],
    ["Resend", t("vendorResend"), "USA", "SOC 2 Type II"],
    ["Google Workspace", t("vendorGoogle"), "EU", "ISO 27001, SOC 2"],
    ["Cloudflare", t("vendorCloudflare"), "EU", "SOC 2 Type II, ISO 27001"],
    ["Sentry", t("vendorSentry"), "Frankfurt (EU)", "SOC 2 Type II, ISO 27001"],
  ];
  const sections: [string, string][] = [
    ["identityTitle", "identityBody"],
    ["dataTitle", "dataBody"],
    ["paymentsTitle", "paymentsBody"],
    ["backupTitle", "backupBody"],
    ["monitoringTitle", "monitoringBody"],
    ["developmentTitle", "developmentBody"],
  ];

  return (
    <main className="min-h-screen bg-[var(--usha-black)] text-[var(--usha-white)]">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link href="/" className="mb-8 inline-flex items-center gap-1.5 text-sm text-[var(--usha-muted)] transition-colors hover:text-[var(--usha-white)]">
          <ArrowLeft size={14} /> {t("back")}
        </Link>

        <div className="mb-2 flex items-center gap-3">
          <ShieldCheck size={32} className="text-[var(--usha-gold)]" />
          <h1 className="text-4xl font-bold">{t("title")}</h1>
        </div>
        <p className="mb-10 text-sm text-[var(--usha-muted)]">{t("lastUpdated")}</p>

        <p className="mb-10 text-base leading-relaxed text-[var(--usha-muted)]">{t("intro")}</p>

        <div className="space-y-8 text-sm leading-relaxed text-[var(--usha-muted)]">
          {sections.map(([title, body]) => (
            <section key={title}>
              <h2 className={h2}>{t(title)}</h2>
              <p>{t(body)}</p>
            </section>
          ))}

          <section>
            <h2 className={h2}>{t("vendorsTitle")}</h2>
            <p className="mb-4">{t("vendorsIntro")}</p>
            <div className="overflow-x-auto rounded-xl border border-[var(--usha-border)]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--usha-card)] text-[var(--usha-white)]">
                  <tr>
                    <th className="px-3 py-2 font-semibold">{t("colVendor")}</th>
                    <th className="px-3 py-2 font-semibold">{t("colPurpose")}</th>
                    <th className="px-3 py-2 font-semibold">{t("colRegion")}</th>
                    <th className="px-3 py-2 font-semibold">{t("colCerts")}</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map(([name, purpose, region, certs]) => (
                    <tr key={name} className="border-t border-[var(--usha-border)]">
                      <td className="px-3 py-2 font-medium text-[var(--usha-white)]">{name}</td>
                      <td className="px-3 py-2">{purpose}</td>
                      <td className="px-3 py-2">{region}</td>
                      <td className="px-3 py-2">{certs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className={h2}>{t("complianceTitle")}</h2>
            <p>{t("complianceBody")}</p>
          </section>

          <section>
            <h2 className={h2}>{t("rightsTitle")}</h2>
            <p>
              {t("rightsBody")}{" "}
              <Link href="/privacy" className="text-[var(--usha-gold)] hover:underline">{t("rightsLink")}</Link>
            </p>
          </section>

          <section className="rounded-xl border border-[var(--usha-gold)]/30 bg-[var(--usha-gold)]/10 p-5">
            <h2 className={h2}>{t("reportTitle")}</h2>
            <p className="mb-2">{t("reportBody")}</p>
            <p className="font-mono text-sm text-[var(--usha-white)]">privacy@usha.se</p>
          </section>
        </div>
      </div>
    </main>
  );
}
