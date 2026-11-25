"use client";

// Gemensam felsida för error.tsx i roten, /app, (auth) och (dashboard).
// Rapporterar felet till Sentry, visar en stor "Rapportera felet"-knapp som
// skickar med felets id (Sentrys event-id, och Next:s digest som tagg) och göms
// hörnknappen medan sidan visas. global-error har egen markup, se den filen.
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useLocale } from "next-intl";
import * as Sentry from "@sentry/nextjs";
import { MessageCircleWarning } from "lucide-react";
import { registerErrorScreen } from "@/lib/feedback/store";
import { fillCode } from "@/lib/feedback/texts";
import { useErrorPageTexts, useFeedbackTexts } from "./use-feedback-texts";

const FeedbackDialog = dynamic(() => import("./feedback-dialog"), { ssr: false });

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
  /** Länken bredvid "Försök igen". Utelämnas där sidan inte hade någon. */
  home?: { href: string; label: "home" | "toApp" };
  className?: string;
};

export function ErrorScreen({ error, reset, home, className }: Props) {
  const t = useErrorPageTexts();
  const feedbackTexts = useFeedbackTexts();
  const locale = useLocale();
  const [eventId, setEventId] = useState<string | undefined>();
  const [canReport, setCanReport] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Utan DSN gör captureException ingenting och knappen visas inte.
    setEventId(Sentry.captureException(error));
    setCanReport(!!Sentry.getClient());
  }, [error]);

  useEffect(() => registerErrorScreen(), []);

  return (
    <div className={className ?? "flex min-h-screen flex-col items-center justify-center px-6 text-center"}>
      <h2 className="mb-2 text-xl font-bold">{t.title}</h2>
      <p className="mb-6 max-w-md text-sm text-[var(--usha-muted)]">{error.message || t.fallback}</p>
      {canReport && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mb-4 flex w-full max-w-xs items-center justify-center gap-2 rounded-lg bg-[var(--usha-gold)] px-5 py-3 text-sm font-semibold text-black"
        >
          <MessageCircleWarning size={18} aria-hidden="true" />
          {t.report}
        </button>
      )}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-lg border border-[var(--usha-border)] px-5 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--usha-card)]"
        >
          {t.retry}
        </button>
        {home && (
          <a
            href={home.href}
            className="rounded-lg px-5 py-2.5 text-sm font-medium text-[var(--usha-muted)] transition-colors hover:text-[var(--usha-white)]"
          >
            {t[home.label]}
          </a>
        )}
      </div>
      {error.digest && <p className="mt-6 text-xs text-[var(--usha-muted)]">{fillCode(t.code, error.digest)}</p>}
      {open && (
        <FeedbackDialog
          texts={feedbackTexts}
          locale={locale}
          source="felsida"
          associatedEventId={eventId}
          digest={error.digest}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
