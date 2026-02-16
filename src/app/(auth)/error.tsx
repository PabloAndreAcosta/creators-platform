"use client";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center text-center px-6">
      <h2 className="mb-2 text-xl font-bold">Något gick fel</h2>
      <p className="mb-6 text-sm text-[var(--usha-muted)]">
        {error.message || "Ett oväntat fel uppstod."}
      </p>
      <button
        onClick={reset}
        className="rounded-lg border border-[var(--usha-border)] px-5 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--usha-card)]"
      >
        Försök igen
      </button>
    </div>
  );
}
