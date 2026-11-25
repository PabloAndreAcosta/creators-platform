"use client";

// Felknappen: en liten ikon i nedre vänstra hörnet på alla sidor. Höger hörn
// har toasterna. I /app (mobil) lyfts den över bottenmenyn. Den göms på
// kiosk-, dörr- och entréskärmarna (hidden-paths.ts) och medan en felsida visar
// sin egen stora knapp. Utan Sentry (ingen DSN) visas den inte alls.
import { useEffect, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import { MessageCircleWarning } from "lucide-react";
import * as Sentry from "@sentry/nextjs";
import { hasBottomNav, isFeedbackHiddenPath } from "@/lib/feedback/hidden-paths";
import { clearAttention, flagAttention, getFeedbackState, subscribeFeedback } from "@/lib/feedback/store";
import { installFetchWatch } from "@/lib/feedback/fetch-watch";
import { lastSentryEventId } from "@/lib/feedback/sentry-adapter";
import { useFeedbackTexts } from "./use-feedback-texts";
import { EXCLUDE_ATTR } from "@/lib/feedback/mask";

const FeedbackDialog = dynamic(() => import("./feedback-dialog"), { ssr: false });

const SERVER_STATE = { attention: false, errorScreens: 0 };

export function FeedbackLauncher() {
  const pathname = usePathname() ?? "";
  const locale = useLocale();
  const texts = useFeedbackTexts();
  const state = useSyncExternalStore(subscribeFeedback, getFeedbackState, () => SERVER_STATE);
  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState<{ eventId?: string } | null>(null);

  useEffect(() => {
    if (!Sentry.getClient()) return;
    setAvailable(true);
    // Lyssnaren sitter kvar så länge sidan lever; den skickar inget själv.
    installFetchWatch(window as unknown as Parameters<typeof installFetchWatch>[0], flagAttention);
  }, []);

  if (!available || isFeedbackHiddenPath(pathname)) return null;
  // En felsida visar sin egen knapp; formuläret som redan är öppet får stå kvar.
  if (state.errorScreens > 0 && !open) return null;

  const lifted = hasBottomNav(pathname);

  return (
    <>
      {!open && (
        <button
          type="button"
          {...{ [EXCLUDE_ATTR]: "" }}
          onClick={() => {
            setOpen({ eventId: lastSentryEventId() });
            clearAttention();
          }}
          aria-label={texts.button}
          title={texts.button}
          className={`fixed left-3 z-40 flex items-center gap-1.5 rounded-full border text-xs font-medium shadow-md backdrop-blur transition-colors md:bottom-4 ${
            lifted ? "bottom-[calc(5rem+env(safe-area-inset-bottom,0px))]" : "bottom-[calc(1rem+env(safe-area-inset-bottom,0px))]"
          } ${
            state.attention
              ? "border-[var(--usha-gold)] bg-[var(--usha-card)] px-3 py-2 text-[var(--usha-gold)]"
              : "border-[var(--usha-border)] bg-[var(--usha-card)]/80 p-2 text-[var(--usha-muted)] opacity-70 hover:opacity-100 md:px-3"
          }`}
        >
          <MessageCircleWarning size={16} aria-hidden="true" />
          <span className={state.attention ? "" : "hidden md:inline"}>{texts.button}</span>
        </button>
      )}
      {open && (
        <FeedbackDialog
          texts={texts}
          locale={locale}
          source="felknapp"
          associatedEventId={open.eventId}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}
