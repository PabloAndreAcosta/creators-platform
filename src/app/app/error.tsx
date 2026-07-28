"use client";

// Error boundary for the authenticated app area (/app/*). Renders inside the app
// shell so a crash in one screen shows a recoverable panel instead of a blank
// page. Dependency-light by design; reports to Sentry.
import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <h2 className="mb-2 text-xl font-bold">Något gick fel</h2>
      <p className="mb-6 max-w-md text-sm text-[var(--usha-muted)]">
        {error.message || "Ett oväntat fel uppstod. Försök igen om en stund."}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-lg border border-[var(--usha-border)] px-5 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--usha-card)]"
        >
          Försök igen
        </button>
        <a
          href="/app"
          className="rounded-lg px-5 py-2.5 text-sm font-medium text-[var(--usha-muted)] transition-colors hover:text-[var(--usha-white)]"
        >
          Till appen
        </a>
      </div>
      {error.digest && (
        <p className="mt-6 text-xs text-[var(--usha-muted)]">Felkod: {error.digest}</p>
      )}
    </div>
  );
}
