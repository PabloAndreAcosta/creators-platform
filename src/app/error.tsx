"use client";

// Root segment error boundary. Catches render/runtime errors thrown anywhere in
// the app tree that a nested error.tsx doesn't handle. Kept dependency-light on
// purpose — an error boundary must never itself throw — so no i18n/context hooks.
import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // No-op when Sentry has no DSN configured.
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
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
          href="/"
          className="rounded-lg px-5 py-2.5 text-sm font-medium text-[var(--usha-muted)] transition-colors hover:text-[var(--usha-white)]"
        >
          Till startsidan
        </a>
      </div>
      {error.digest && (
        <p className="mt-6 text-xs text-[var(--usha-muted)]">Felkod: {error.digest}</p>
      )}
    </div>
  );
}
