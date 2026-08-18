import Link from "next/link";
import { useTranslations } from "next-intl";
import { CheckCircle2, Circle, ArrowRight, Rocket } from "lucide-react";
import { buildOnboardingSteps, onboardingProgress, type OnboardingContext } from "@/lib/onboarding/checklist";

/**
 * Category-aware onboarding checklist. Steps are computed from real profile state
 * by buildOnboardingSteps() (creator / creator-with-company / venue / customer),
 * and link to the existing dashboard gates.
 */
export function OnboardingChecklist(props: OnboardingContext) {
  const t = useTranslations("onboarding");
  const steps = buildOnboardingSteps(props);
  const { done, total } = onboardingProgress(steps);

  // Hide once everything is done — keep the dashboard clean for established users.
  if (done === total) return null;

  return (
    <section className="rounded-2xl border border-[var(--usha-gold)]/25 bg-[var(--usha-gold)]/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <Rocket size={16} className="text-[var(--usha-gold)]" />
          {t("title")}
        </h2>
        <span className="text-xs text-[var(--usha-muted)]">{t("progress", { done, total })}</span>
      </div>

      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--usha-border)]">
        <div className="h-full rounded-full bg-[var(--usha-gold)]" style={{ width: `${(done / total) * 100}%` }} />
      </div>

      <ul className="space-y-0.5">
        {steps.map((s) =>
          s.done ? (
            <li key={s.key} className="flex items-center gap-2 px-1 py-1.5 text-sm text-[var(--usha-muted)] line-through">
              <CheckCircle2 size={16} className="shrink-0 text-green-400" />
              {t(s.labelKey)}
            </li>
          ) : (
            <li key={s.key}>
              <Link href={s.href} className="flex items-center gap-2 rounded-lg px-1 py-1.5 text-sm transition hover:text-[var(--usha-gold)]">
                <Circle size={16} className="shrink-0 text-[var(--usha-muted)]" />
                <span className="flex-1">
                  {t(s.labelKey)}
                  {!s.required && <span className="ml-1 text-xs text-[var(--usha-muted)]">({t("optional")})</span>}
                </span>
                <ArrowRight size={14} className="shrink-0 text-[var(--usha-muted)]" />
              </Link>
            </li>
          )
        )}
      </ul>
    </section>
  );
}

// Back-compat alias — some call sites import CreatorOnboarding.
export const CreatorOnboarding = OnboardingChecklist;
