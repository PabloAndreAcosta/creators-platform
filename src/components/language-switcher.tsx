"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { LOCALE_COOKIE_NAME, type Locale } from "@/i18n/config";
import { Globe } from "lucide-react";

export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("language");

  function switchLocale() {
    const next: Locale = locale === "sv" ? "en" : "sv";
    document.cookie = `${LOCALE_COOKIE_NAME}=${next};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
    router.refresh();
  }

  return (
    <button
      onClick={switchLocale}
      className={
        className ??
        "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-[var(--usha-muted)] transition-colors hover:bg-[var(--usha-card)] hover:text-white"
      }
      aria-label={t("switchTo")}
    >
      <Globe size={16} />
      <span>{t("switchTo")}</span>
    </button>
  );
}
