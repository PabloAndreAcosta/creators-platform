"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ExternalLink, Copy, Check } from "lucide-react";
import { chromeIntentUrl, detectInAppBrowser, isAndroid, type InAppBrowser } from "@/lib/auth/in-app-browser";

/** Vilken app-webbläsare sidan körs i, eller null. Sätts efter första renderingen. */
export function useInAppBrowser(): InAppBrowser | null {
  const [app, setApp] = useState<InAppBrowser | null>(null);
  useEffect(() => {
    setApp(detectInAppBrowser(navigator.userAgent));
  }, []);
  return app;
}

/**
 * Ruta på inloggning och registrering när sidan öppnats inne i en app.
 * Google går inte att använda där, så vi pekar till telefonens webbläsare.
 */
export function InAppBrowserNotice({ app }: { app: InAppBrowser | null }) {
  const t = useTranslations("auth");
  const [copied, setCopied] = useState(false);
  const [android, setAndroid] = useState(false);
  useEffect(() => setAndroid(isAndroid(navigator.userAgent)), []);
  if (!app) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      window.prompt(t("inAppCopyPrompt"), window.location.href);
    }
  }

  return (
    <div className="mb-6 rounded-xl border border-[var(--usha-gold)]/40 bg-[var(--usha-gold)]/10 px-4 py-3 text-sm" role="status">
      <p className="font-semibold">{t("inAppTitle", { app })}</p>
      <p className="mt-1 text-[var(--usha-muted)]">{t(android ? "inAppBodyAndroid" : "inAppBodyIos", { app })}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {android ? (
          <a
            href={typeof window !== "undefined" ? chromeIntentUrl(window.location.href) : "#"}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-4 text-sm font-semibold text-black"
          >
            <ExternalLink size={14} /> {t("inAppOpenChrome")}
          </a>
        ) : null}
        <button
          type="button"
          onClick={copy}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-[var(--usha-border)] px-4 text-sm font-medium"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? t("inAppCopied") : t("inAppCopy")}
        </button>
      </div>
    </div>
  );
}
