"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { X, Check } from "lucide-react";

const PRESET_STYLES = ["Kizomba", "Urban Kiz", "Bachata", "Salsa", "Afrobeats", "Zouk", "Tango"];
const LEVELS = ["nyborjare", "medel", "avancerad"] as const;

interface Prefs {
  dance_styles?: string[];
  skill_level?: string | null;
  city?: string | null;
}

export function MatchingOnboardingModal({
  open,
  onClose,
  onSaved,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  initial?: Prefs | null;
}) {
  const t = useTranslations("matching.onboarding");
  const [styles, setStyles] = useState<string[]>([]);
  const [level, setLevel] = useState<string | null>(null);
  const [city, setCity] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setStyles(initial?.dance_styles?.map((s) => s) ?? []);
      setLevel(initial?.skill_level ?? null);
      setCity(initial?.city ?? "");
    }
  }, [open, initial]);

  if (!open) return null;

  const toggleStyle = (s: string) =>
    setStyles((cur) => (cur.some((x) => x.toLowerCase() === s.toLowerCase()) ? cur.filter((x) => x.toLowerCase() !== s.toLowerCase()) : [...cur, s]));

  async function save(skip = false) {
    setSaving(true);
    try {
      await fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          skip
            ? { dance_styles: [], skill_level: null, city: null }
            : { dance_styles: styles, skill_level: level, city: city.trim() || null }
        ),
      });
      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-t-2xl border border-[var(--usha-border)] bg-[var(--usha-black)] p-6 shadow-2xl sm:rounded-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded p-1 text-[var(--usha-muted)] transition hover:text-[var(--usha-white)]"
          aria-label={t("close")}
        >
          <X size={16} />
        </button>

        <h3 className="mb-1 text-lg font-bold text-[var(--usha-white)]">{t("title")}</h3>
        <p className="mb-5 text-sm text-[var(--usha-muted)]">{t("subtitle")}</p>

        {/* 1. Styles */}
        <p className="mb-2 text-sm font-semibold text-[var(--usha-white)]">{t("stylesLabel")}</p>
        <div className="mb-5 flex flex-wrap gap-2">
          {PRESET_STYLES.map((s) => {
            const on = styles.some((x) => x.toLowerCase() === s.toLowerCase());
            return (
              <button
                key={s}
                onClick={() => toggleStyle(s)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  on
                    ? "bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] text-black"
                    : "border border-[var(--usha-border)] text-[var(--usha-muted)] hover:text-[var(--usha-white)]"
                }`}
              >
                {on && <Check size={11} className="mr-1 inline" />}{s}
              </button>
            );
          })}
        </div>

        {/* 2. Level */}
        <p className="mb-2 text-sm font-semibold text-[var(--usha-white)]">{t("levelLabel")}</p>
        <div className="mb-5 inline-flex rounded-lg border border-[var(--usha-border)] p-1">
          {LEVELS.map((lv) => (
            <button
              key={lv}
              onClick={() => setLevel(level === lv ? null : lv)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                level === lv
                  ? "bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] text-black"
                  : "text-[var(--usha-muted)] hover:text-[var(--usha-white)]"
              }`}
            >
              {t(`level.${lv}`)}
            </button>
          ))}
        </div>

        {/* 3. City */}
        <p className="mb-2 text-sm font-semibold text-[var(--usha-white)]">{t("cityLabel")}</p>
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder={t("cityPlaceholder")}
          className="mb-6 w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-2.5 text-sm text-[var(--usha-white)] outline-none focus:border-[var(--usha-gold)]/40"
        />

        <div className="flex gap-3">
          <button
            onClick={() => save(true)}
            disabled={saving}
            className="flex-1 rounded-xl border border-[var(--usha-border)] py-3 text-sm font-medium text-[var(--usha-muted)] transition hover:text-[var(--usha-white)] disabled:opacity-50"
          >
            {t("skip")}
          </button>
          <button
            onClick={() => save(false)}
            disabled={saving}
            className="flex-1 rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] py-3 text-sm font-bold text-black transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? t("saving") : t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}
