"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { LOCALE_COOKIE_NAME, locales, type Locale } from "@/i18n/config";

// Uppercase codes, matching the shop's SV / EN / ES segmented switcher.
const LABELS: Record<Locale, string> = { sv: "SV", en: "EN", es: "ES" };
const NAMES: Record<Locale, string> = { sv: "Svenska", en: "English", es: "Español" };

export function LanguageSwitcher({ className }: { className?: string }) {
  const active = useLocale() as Locale;
  const router = useRouter();

  function setLocale(next: Locale) {
    if (next === active) return;
    document.cookie = `${LOCALE_COOKIE_NAME}=${next};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
    router.refresh();
  }

  return (
    <div
      role="group"
      aria-label="Language"
      className={
        className ??
        "inline-flex items-center gap-0.5 rounded-lg border border-[var(--usha-border)] p-0.5"
      }
    >
      {locales.map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => setLocale(loc)}
          aria-pressed={active === loc}
          aria-label={NAMES[loc]}
          className={`rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
            active === loc
              ? "bg-[var(--usha-gold)] text-black"
              : "text-[var(--usha-muted)] hover:text-[var(--usha-white)]"
          }`}
        >
          {LABELS[loc]}
        </button>
      ))}
    </div>
  );
}
