import { useTranslations } from "next-intl";
import { UserPlus, Palette, CalendarCheck } from "lucide-react";

/** "Get started in 3 steps" — creator-flow; lives on /for-kreatorer. */
export function Onboarding() {
  const t = useTranslations("landing");

  const ONBOARDING_STEPS = [
    { icon: UserPlus, title: t("onboarding.step1Title"), desc: t("onboarding.step1Desc") },
    { icon: Palette, title: t("onboarding.step2Title"), desc: t("onboarding.step2Desc") },
    { icon: CalendarCheck, title: t("onboarding.step3Title"), desc: t("onboarding.step3Desc") },
  ];

  return (
    <section className="relative py-16 px-4 sm:py-20 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-10 text-center sm:mb-12">
          <h2 className="mb-3 text-2xl font-bold tracking-tight sm:mb-4 sm:text-3xl">
            {t("onboarding.title")} <span className="text-gradient">{t("onboarding.titleHighlight")}</span>
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {ONBOARDING_STEPS.map((step, i) => (
            <div key={step.title} className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--usha-gold)] to-[var(--usha-accent)]">
                <step.icon size={20} className="text-black" />
              </div>
              <span className="mb-2 block font-mono text-xs text-[var(--usha-muted)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mb-1 font-semibold">{step.title}</h3>
              <p className="text-sm text-[var(--usha-muted)]">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
