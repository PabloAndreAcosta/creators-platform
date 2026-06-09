"use client";

import { useEffect, useState } from "react";
import { Download, Smartphone, Share } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Prominent "install the app" banner for the scan page. An installed PWA gets
// its own, more reliable camera permission (and shows up among phone apps).
export function ScanInstallBanner() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) {
      setInstalled(true);
      return;
    }
    setIsIOS(/iphone|ipad|ipod/i.test(window.navigator.userAgent));
    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (installed) return null;

  async function handleInstall() {
    if (prompt) {
      prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === "accepted") setPrompt(null);
      return;
    }
    // iOS Safari (and other browsers) have no install event — show instructions.
    setShowHelp((v) => !v);
  }

  return (
    <div className="mb-4 rounded-xl border border-[var(--usha-gold)]/30 bg-[var(--usha-gold)]/5 p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--usha-gold)] to-[var(--usha-accent)]">
          <Smartphone size={18} className="text-black" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--usha-white)]">Installera Usch-Ja</p>
          <p className="text-xs text-[var(--usha-muted)]">
            Smidigare skanning — en installerad app får egen kameraåtkomst.
          </p>
        </div>
        <button
          onClick={handleInstall}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-4 py-2 text-sm font-bold text-black transition hover:opacity-90"
        >
          <Download size={15} />
          Installera
        </button>
      </div>
      {showHelp && (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-[var(--usha-muted)]">
          <Share size={13} className="mt-0.5 shrink-0" />
          {isIOS
            ? 'iPhone (Safari): tryck på Dela-ikonen längst ner → "Lägg till på hemskärmen".'
            : "Öppna webbläsarens meny (⋮) → \"Installera app\" / \"Lägg till på startskärmen\"."}
        </p>
      )}
    </div>
  );
}
