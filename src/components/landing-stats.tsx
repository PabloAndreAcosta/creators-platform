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
    <section className="relative px-4 pb-4 sm:px-6">
      <div className="mx-auto grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((i) => (
          <div
            key={i.label}
            className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-5 text-center"
          >
            <p className="text-2xl font-extrabold text-gradient sm:text-3xl">
              {i.value.toLocaleString("sv-SE")}
            </p>
            <p className="mt-1 text-xs text-[var(--usha-muted)]">{i.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
