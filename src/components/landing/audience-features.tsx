import { useTranslations } from "next-intl";
import { Users, Ticket, Sparkles, ShieldCheck, type LucideIcon } from "lucide-react";

// Audience-facing feature highlights for /for-publik. Mirrors the creator
// Features grid visually, but with consumer features — Träningsvänner leads as
// the genuinely new one.
type Item = { key: string; icon: LucideIcon; href?: string; isNew?: boolean };

const ITEMS: Item[] = [
  { key: "buddies", icon: Users, href: "/app/training-buddies", isNew: true },
  { key: "tickets", icon: Ticket, href: "/upplevelser" },
  { key: "forYou", icon: Sparkles, href: "/upplevelser" },
  { key: "safe", icon: ShieldCheck },
];

export function AudienceFeatures() {
  const t = useTranslations("forAudience");

  return (
    <section id="features" className="relative py-16 px-4 sm:py-24 sm:px-6">
      <div className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="h-[500px] w-[700px] rounded-full bg-[var(--usha-accent)] opacity-[0.03] blur-[180px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl">
        <div className="mb-10 text-center sm:mb-14">
          <h2 className="mb-3 text-2xl font-bold tracking-tight sm:mb-4 sm:text-3xl md:text-4xl">
            {t("features.title")} <span className="text-gradient">{t("features.titleHighlight")}</span>
          </h2>
          <p className="mx-auto max-w-xl text-[var(--usha-muted)]">{t("features.subtitle")}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {ITEMS.map((f) => {
            const card = (
              <>
                {f.isNew && (
                  <span className="absolute right-3 top-3 rounded-full bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-black">
                    {t("features.newBadge")}
                  </span>
                )}
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--usha-gold)]/20 to-[var(--usha-accent)]/20">
                  <f.icon size={20} className="text-[var(--usha-gold)]" />
                </div>
                <h3 className="text-sm font-semibold sm:text-base">{t(`features.items.${f.key}.title`)}</h3>
                <p className="mt-1 text-xs leading-relaxed text-[var(--usha-muted)] sm:text-sm">
                  {t(`features.items.${f.key}.desc`)}
                </p>
              </>
            );
            const cls =
              "relative rounded-2xl border border-[var(--usha-gold)]/30 bg-[var(--usha-card)] p-5 transition hover:border-[var(--usha-gold)]/60";
            return f.href ? (
              <a key={f.key} href={f.href} className={cls}>
                {card}
              </a>
            ) : (
              <div key={f.key} className={cls}>
                {card}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
