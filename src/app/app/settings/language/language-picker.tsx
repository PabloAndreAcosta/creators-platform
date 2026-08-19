"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Check, Loader2 } from "lucide-react";
import { LOCALE_COOKIE_NAME, locales, type Locale } from "@/i18n/config";

/** Each language names itself — a reader looking for their own recognises it. */
const NAMES: Record<Locale, string> = {
  sv: "Svenska",
  en: "English",
  es: "Español",
};

export function LanguagePicker() {
  const active = useLocale() as Locale;
  const router = useRouter();
  const t = useTranslations("languageSettings");
  const [saving, setSaving] = useState<Locale | null>(null);

  async function choose(next: Locale) {
    if (next === active || saving) return;
    setSaving(next);

    // The cookie is what every page read decides on, and it lives for a year —
    // which is why a language picked once, or guessed once, used to be
    // unchangeable from anywhere but the desktop sidebar.
    document.cookie = `${LOCALE_COOKIE_NAME}=${next};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;

    // Also on the account, so transactional mail matches what's on screen.
    try {
      await fetch("/api/settings/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: next }),
      });
    } catch {
      // The cookie already switched the app; a failed write only affects email.
    }

    router.refresh();
    setSaving(null);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)]">
      {locales.map((loc) => {
        const isActive = loc === active;
        return (
          <button
            key={loc}
            type="button"
            onClick={() => choose(loc)}
            aria-current={isActive ? "true" : undefined}
            className="flex w-full items-center justify-between gap-3 border-b border-[var(--usha-border)] px-4 py-3.5 text-left transition-colors last:border-0 hover:bg-[var(--usha-black)]/40"
          >
            <span className={`text-sm ${isActive ? "font-semibold text-[var(--usha-white)]" : ""}`}>
              {NAMES[loc]}
            </span>
            {saving === loc ? (
              <Loader2 size={16} className="animate-spin text-[var(--usha-muted)]" />
            ) : isActive ? (
              <Check size={16} className="text-[var(--usha-gold)]" />
            ) : null}
          </button>
        );
      })}
      <p className="border-t border-[var(--usha-border)] px-4 py-3 text-xs text-[var(--usha-muted)]">
        {t("hint")}
      </p>
    </div>
  );
}
