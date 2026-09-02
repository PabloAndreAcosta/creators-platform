"use client";

import { useState, useTransition } from "react";
import { Check, X, MapPin } from "lucide-react";
import { respondToVenueRequest } from "./actions";

interface Item {
  id: string;
  title: string;
  eventDate: string | null;
  eventTime: string | null;
  location: string | null;
  organiser: string | null;
  /** Färdigöversatt "Arrangeras av X" — översätts på servern, se page.tsx. */
  byLabel: string | null;
  confirmed: boolean;
}

interface Labels {
  heading: string;
  intro: string;
  empty: string;
  pending: string;
  confirmed: string;
  approve: string;
  decline: string;
  withdraw: string;
  failed: string;
}

export default function VenueRequestsContent({ items, labels }: { items: Item[]; labels: Labels }) {
  const [rows, setRows] = useState(items);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function respond(id: string, confirm: boolean) {
    setPendingId(id);
    setError(null);
    startTransition(async () => {
      const res = await respondToVenueRequest(id, confirm);
      if (res?.error) {
        setError(labels.failed);
      } else {
        // Optimistiskt: raden byter läge direkt. Ett nej tar bort kopplingens
        // verkan men behåller raden, så lokalen kan ångra sig utan att
        // arrangören måste lägga upp evenemanget på nytt.
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, confirmed: confirm } : r)));
      }
      setPendingId(null);
    });
  }

  return (
    <main className="min-h-screen bg-[var(--usha-black)] text-[var(--usha-white)]">
      <div className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="mb-2 text-xl font-bold">{labels.heading}</h1>
        <p className="mb-6 text-sm text-[var(--usha-muted)]">{labels.intro}</p>

        {error && (
          <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-200">
            {error}
          </p>
        )}

        {rows.length === 0 ? (
          <p className="text-sm text-[var(--usha-muted)]">{labels.empty}</p>
        ) : (
          <ul className="space-y-3">
            {rows.map((r) => (
              <li
                key={r.id}
                className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5"
              >
                <div className="mb-1 flex items-start justify-between gap-3">
                  <h2 className="font-semibold">{r.title}</h2>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                      r.confirmed
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-amber-500/15 text-amber-300"
                    }`}
                  >
                    {r.confirmed ? labels.confirmed : labels.pending}
                  </span>
                </div>

                <p className="text-xs text-[var(--usha-muted)]">
                  {[r.eventDate, r.eventTime].filter(Boolean).join(" · ")}
                </p>
                {r.byLabel && (
                  <p className="mt-0.5 text-xs text-[var(--usha-muted)]">{r.byLabel}</p>
                )}
                {r.location && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--usha-muted)]">
                    <MapPin size={12} />
                    {r.location}
                  </p>
                )}

                <div className="mt-4 flex gap-2">
                  {r.confirmed ? (
                    <button
                      onClick={() => respond(r.id, false)}
                      disabled={pendingId === r.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--usha-border)] px-4 py-2 text-xs font-medium transition hover:border-red-500/40 hover:text-red-300 disabled:opacity-50"
                    >
                      <X size={13} />
                      {labels.withdraw}
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => respond(r.id, true)}
                        disabled={pendingId === r.id}
                        className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-4 py-2 text-xs font-bold text-black transition hover:opacity-90 disabled:opacity-50"
                      >
                        <Check size={13} />
                        {labels.approve}
                      </button>
                      <button
                        onClick={() => respond(r.id, false)}
                        disabled={pendingId === r.id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--usha-border)] px-4 py-2 text-xs font-medium transition hover:border-red-500/40 hover:text-red-300 disabled:opacity-50"
                      >
                        <X size={13} />
                        {labels.decline}
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
