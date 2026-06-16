import { useTranslations } from "next-intl";
import { Palette, Store, Sparkles, ArrowRight } from "lucide-react";

/** The three "doors" into the cycle — one per audience. Used in the home hero.
 *  "I want to experience" is visually primary (most traffic). */
export function AudienceDoors() {
  const t = useTranslations("landing.doors");

  const doors = [
    { href: "/for-kreatorer", icon: Palette, label: t("creatorLabel"), desc: t("creatorDesc"), primary: false },
    { href: "/for-platser", icon: Store, label: t("venueLabel"), desc: t("venueDesc"), primary: false },
    { href: "/for-publik", icon: Sparkles, label: t("audienceLabel"), desc: t("audienceDesc"), primary: true },
  ];

  return (
    <div className="grid w-full gap-4 text-left sm:grid-cols-3 sm:gap-5">
      {doors.map((d) => (
        <a
          key={d.href}
          href={d.href}
          className={`group rounded-2xl border p-6 transition hover:scale-[1.01] ${
            d.primary
              ? "glow-gold border-[var(--usha-gold)]/40 bg-gradient-to-br from-[var(--usha-gold)]/10 to-[var(--usha-accent)]/5"
              : "border-[var(--usha-border)] bg-[var(--usha-card)] hover:border-[var(--usha-gold)]/30"
          }`}
        >
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--usha-gold)]/20 to-[var(--usha-accent)]/20">
            <d.icon size={18} className="text-[var(--usha-gold)]" />
          </div>
          <div className="flex items-center gap-1.5 font-semibold">
            {d.label}
            <ArrowRight size={14} className="-translate-x-1 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" />
          </div>
          <p className="mt-1 text-sm text-[var(--usha-muted)]">{d.desc}</p>
        </a>
      ))}
    </div>
  );
}
