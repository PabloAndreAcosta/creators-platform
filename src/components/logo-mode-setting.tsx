"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ImageIcon } from "lucide-react";
import { getLogoLage, setLogoLage, type LogoLage } from "@/components/UschjaLogo";

export function LogoModeSetting() {
  const t = useTranslations("settings.logo");
  const [lage, setLage] = useState<LogoLage>("system");

  useEffect(() => {
    setLage(getLogoLage());
  }, []);

  const options: { key: LogoLage; label: string }[] = [
    { key: "system", label: t("system") },
    { key: "ljus", label: t("light") },
    { key: "mork", label: t("dark") },
  ];

  function choose(k: LogoLage) {
    setLage(k);
    setLogoLage(k);
  }

  return (
    <div className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4">
      <div className="mb-3 flex items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--usha-border)]">
          <ImageIcon size={18} className="text-[var(--usha-muted)]" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{t("title")}</p>
          <p className="text-xs text-[var(--usha-muted)]">{t("desc")}</p>
        </div>
      </div>
      <div className="inline-flex rounded-lg border border-[var(--usha-border)] p-1">
        {options.map((o) => (
          <button
            key={o.key}
            onClick={() => choose(o.key)}
            aria-pressed={lage === o.key}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
              lage === o.key
                ? "bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] text-black"
                : "text-[var(--usha-muted)] hover:text-[var(--usha-white)]"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
