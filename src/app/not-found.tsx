import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--usha-gold)] to-[var(--usha-accent)]">
        <span className="text-2xl font-bold text-black">U</span>
      </div>
      <h1 className="mb-2 text-5xl font-bold">404</h1>
      <p className="mb-6 text-lg text-[var(--usha-muted)]">
        Sidan kunde inte hittas.
      </p>
      <div className="flex gap-3">
        <Link
          href="/"
          className="rounded-xl border border-[var(--usha-border)] px-6 py-3 text-sm font-medium transition hover:bg-[var(--usha-card)]"
        >
          Startsida
        </Link>
        <Link
          href="/marketplace"
          className="rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-6 py-3 text-sm font-bold text-black transition hover:opacity-90"
        >
          Marketplace
        </Link>
      </div>
    </div>
  );
}
