"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { OPEN_CONSENT_EVENT, readConsent, saveConsent, type ConsentChoice } from "@/lib/consent";

/**
 * Frågar om statistikcookies. Båda valen är lika stora och lika lätta att
 * trycka på — att tacka nej ska vara precis lika enkelt som att godkänna.
 * Visas bara när Google Analytics är påslaget och inget val finns, eller när
 * någon öppnar Cookieinställningar.
 */
export function ConsentBanner() {
  const t = useTranslations("consent");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID) return;
    if (readConsent(document.cookie) === null) setOpen(true);
    const reopen = () => {
      setOpen(true);
    };
    window.addEventListener(OPEN_CONSENT_EVENT, reopen);
    return () => {
      window.removeEventListener(OPEN_CONSENT_EVENT, reopen);
    };
  }, []);

  if (!open) return null;

  const choose = (choice: ConsentChoice) => {
    saveConsent(choice);
    setOpen(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="consent-title"
      className="fixed inset-x-0 bottom-0 z-[100] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
    >
      <div className="mx-auto max-w-xl rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5 shadow-2xl">
        <p id="consent-title" className="font-semibold text-[var(--usha-white)]">
          {t("title")}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--usha-muted)]">
          {t("body")}{" "}
          <Link href="/cookies" className="underline hover:text-[var(--usha-white)]">
            {t("readMore")}
          </Link>
        </p>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => choose("denied")}
            className="rounded-xl border border-[var(--usha-border)] px-4 py-3 text-sm font-semibold text-[var(--usha-white)] transition hover:border-[var(--usha-gold)]"
          >
            {t("decline")}
          </button>
          <button
            type="button"
            onClick={() => choose("granted")}
            className="rounded-xl border border-[var(--usha-border)] px-4 py-3 text-sm font-semibold text-[var(--usha-white)] transition hover:border-[var(--usha-gold)]"
          >
            {t("accept")}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Länken som öppnar valet igen, t.ex. i sidfoten och på cookiesidan. */
export function ConsentSettingsLink({ className }: { className?: string }) {
  const t = useTranslations("consent");
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))}
      className={className}
    >
      {t("settings")}
    </button>
  );
}
