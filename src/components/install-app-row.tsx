"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Download, ChevronDown } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * A settings-list row that installs the PWA.
 *
 * - Chrome/Edge (Android/desktop): captures `beforeinstallprompt` and fires the
 *   native install dialog on tap.
 * - iOS Safari (never fires the event) or Chrome when the prompt is throttled:
 *   taps expand inline manual instructions instead — so there's always a way in,
 *   even when the browser's own install affordance has gone quiet.
 * - Hidden entirely once the app is running standalone (already installed).
 */
export function InstallAppRow() {
  const t = useTranslations("landing.install");
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari standalone flag
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) setIsInstalled(true);

    setIsIOS(/iphone|ipad|ipod/i.test(window.navigator.userAgent));

    const installedHandler = () => setIsInstalled(true);
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  if (isInstalled) return null;

  const handleClick = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === "accepted") setInstallPrompt(null);
      return;
    }
    // No native prompt available → reveal manual steps.
    setShowHelp((v) => !v);
  };

  const hasNativePrompt = !!installPrompt;

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[var(--usha-card-hover)]"
        aria-expanded={hasNativePrompt ? undefined : showHelp}
      >
        <Download size={18} className="text-[var(--usha-gold)]" />
        <span className="flex-1 text-sm font-medium">{t("downloadApp")}</span>
        {!hasNativePrompt && (
          <ChevronDown
            size={16}
            className={`text-[var(--usha-muted)] transition-transform ${
              showHelp ? "rotate-180" : ""
            }`}
          />
        )}
      </button>
      {!hasNativePrompt && showHelp && (
        <p className="px-4 pb-3.5 -mt-1 text-xs leading-relaxed text-[var(--usha-muted)]">
          {isIOS ? t("iosHelp") : t("otherHelp")}
        </p>
      )}
    </div>
  );
}
