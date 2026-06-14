import { useTranslations } from "next-intl";
import {
  Sparkles, Ticket, QrCode, Users, ScanLine, Banknote, Radio, BarChart3,
  Fingerprint, CreditCard, Store, Newspaper, CalendarCheck, BookOpen, Gift,
  type LucideIcon,
} from "lucide-react";

// Creator tooling — grouped instead of one flat list of ~16. Four hero
// features up top, the rest in three compact groups. "Nyhet" is reserved for
// what is genuinely new (the crew-collaboration cluster).
type Item = { key: string; icon: LucideIcon; isNew?: boolean };

const HERO: Item[] = [
  { key: "create", icon: Sparkles },
  { key: "tickets", icon: Ticket },
  { key: "scan", icon: QrCode },
  { key: "gage", icon: Banknote, isNew: true },
];

const GROUPS: { heading: string; items: Item[] }[] = [
  {
    heading: "doorTeam",
    items: [
      { key: "crew", icon: Users, isNew: true },
      { key: "delegateScan", icon: ScanLine, isNew: true },
      { key: "live", icon: Radio },
    ],
  },
  {
    heading: "payInsight",
    items: [
      { key: "payments", icon: CreditCard },
      { key: "stats", icon: BarChart3 },
      { key: "bankid", icon: Fingerprint },
    ],
  },
  {
    heading: "growReach",
    items: [
      { key: "marketplace", icon: Store },
      { key: "feed", icon: Newspaper },
      { key: "calendar", icon: CalendarCheck },
      { key: "courses", icon: BookOpen },
      { key: "rewards", icon: Gift },
    ],
  },
];

export function Features() {
  const t = useTranslations("landing");

  return (
    <section id="features" className="relative py-16 px-4 sm:py-28 sm:px-6">
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

        {/* Hero features */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {HERO.map((f) => (
            <div key={f.key} className="relative rounded-2xl border border-[var(--usha-gold)]/30 bg-[var(--usha-card)] p-5">
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
            </div>
          ))}
        </div>

        {/* Grouped rest — compact */}
        <div className="mt-10 grid gap-8 sm:mt-14 sm:grid-cols-3 sm:gap-6">
          {GROUPS.map((group) => (
            <div key={group.heading}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--usha-gold)]">
                {t(`features.groups.${group.heading}`)}
              </h3>
              <ul className="space-y-3">
                {group.items.map((f) => (
                  <li key={f.key} className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--usha-gold)]/10">
                      <f.icon size={15} className="text-[var(--usha-gold)]" />
                    </div>
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-sm font-medium">
                        {t(`features.items.${f.key}.title`)}
                        {f.isNew && (
                          <span className="rounded-full bg-[var(--usha-gold)]/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-[var(--usha-gold)]">
                            {t("features.newBadge")}
                          </span>
                        )}
                      </p>
                      <p className="text-xs leading-relaxed text-[var(--usha-muted)]">
                        {t(`features.items.${f.key}.desc`)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
