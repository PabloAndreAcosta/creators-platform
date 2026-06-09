"use client";

import { useEffect, useState } from "react";
import { Download, Share } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Centered install CTA for the bottom of the landing page. Triggers the native
// install dialog on Android/Chrome and shows Add-to-Home-Screen steps on iOS.
export function LandingInstall() {
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
    setShowHelp((v) => !v);
  }

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <button
        onClick={handleInstall}
        className="glow-gold inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-8 py-4 text-base font-bold text-black transition hover:scale-[1.02] hover:opacity-90"
      >
        <Download size={18} />
        Installera Usch-Ja app
      </button>
      {showHelp && (
        <p className="flex items-start justify-center gap-1.5 text-xs text-[var(--usha-muted)]">
          <Share size={13} className="mt-0.5 shrink-0" />
          {isIOS
            ? 'iPhone (Safari): tryck på Dela-ikonen → "Lägg till på hemskärmen".'
            : "Öppna webbläsarens meny (⋮) → \"Installera app\" / \"Lägg till på startskärmen\"."}
        </p>
      )}
    </div>
  );
}
