import { useTranslations } from "next-intl";
import { Fingerprint, Lock, ShieldCheck, Users, Shield } from "lucide-react";

/** BankID/Stripe trust section — shared by the home page and the three
 *  perspective pages. */
export function Trust() {
  const t = useTranslations("landing");

  const TRUST_POINTS = [
    { icon: Fingerprint, title: t("trust.bankid.title"), desc: t("trust.bankid.desc") },
    { icon: Lock, title: t("trust.payment.title"), desc: t("trust.payment.desc") },
    { icon: ShieldCheck, title: t("trust.booking.title"), desc: t("trust.booking.desc") },
    { icon: Users, title: t("trust.crew.title"), desc: t("trust.crew.desc") },
  ];

  return (
    <section className="relative py-16 px-4 sm:py-28 sm:px-6">
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="h-[400px] w-[600px] rounded-full bg-[var(--usha-gold)] opacity-[0.03] blur-[150px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl">
        <div className="mb-10 text-center sm:mb-16">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--usha-gold)]/20 bg-[var(--usha-card)] px-4 py-1.5 text-xs sm:mb-4">
            <Shield size={12} className="text-[var(--usha-gold)]" />
            <span className="text-[var(--usha-muted)]">{t("trust.badge")}</span>
          </div>
          <h2 className="mb-3 text-2xl font-bold tracking-tight sm:mb-4 sm:text-3xl md:text-4xl">
            {t("trust.title")} <span className="text-gradient">{t("trust.titleHighlight")}</span>
          </h2>
          <p className="mx-auto max-w-xl text-[var(--usha-muted)]">{t("trust.subtitle")}</p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST_POINTS.map((point) => (
            <div
              key={point.title}
              className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6 transition hover:border-[var(--usha-gold)]/20"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--usha-gold)]/20 to-[var(--usha-accent)]/20">
                <point.icon size={20} className="text-[var(--usha-gold)]" />
              </div>
              <h3 className="mb-2 font-semibold">{point.title}</h3>
              <p className="text-sm leading-relaxed text-[var(--usha-muted)]">{point.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
