"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

interface Stats {
  events: number;
  creators: number;
  checkIns: number;
  cities: number;
}

// Real, aggregate platform numbers as social proof. Renders nothing until at
// least two metrics are meaningful, so the beta never shows trivial counts.
export function LandingStats() {
  const t = useTranslations("landing");
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/public/stats")
      .then((r) => r.json())
      .then((d) => active && setStats(d))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (!stats) return null;

  const items = [
    { value: stats.events, label: t("stats.events") },
    { value: stats.creators, label: t("stats.creators") },
    { value: stats.checkIns, label: t("stats.checkIns") },
    { value: stats.cities, label: t("stats.cities") },
  ].filter((i) => i.value > 0);

  if (items.length < 2) return null;

  return (
    <section className="relative px-4 pt-12 pb-8 sm:px-6 sm:pt-20 sm:pb-12">
      <div className="mx-auto max-w-3xl">
        {/* Honest early-stage framing: the numbers are small because we just
            started — reframe that as an invitation rather than hiding it. */}
        <div className="mb-6 text-center sm:mb-8">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--usha-gold)]/25 bg-[var(--usha-card)] px-3 py-1 text-xs text-[var(--usha-gold)]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--usha-gold)]" />
            {t("stats.liveBadge")}
          </span>
          <h2 className="mt-3 text-xl font-bold sm:text-2xl">{t("stats.framingTitle")}</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-[var(--usha-muted)]">
            {t("stats.framingSubtitle")}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-5">
          {items.map((i) => (
            <div
              key={i.label}
              className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-6 text-center"
            >
              <p className="text-2xl font-extrabold text-gradient sm:text-3xl">
                {i.value.toLocaleString("sv-SE")}
              </p>
              <p className="mt-1 text-xs text-[var(--usha-muted)]">{i.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
