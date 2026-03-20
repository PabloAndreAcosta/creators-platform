"use client";

import { useState } from "react";
import { Camera, CheckCircle, XCircle, Search } from "lucide-react";

interface TicketResult {
  valid: boolean;
  status: string;
  ticket: {
    code: string;
    title: string;
    date: string;
    time: string | null;
    location: string | null;
  };
}

export default function ScanPage() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TicketResult | null>(null);
  const [error, setError] = useState("");

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);

    const trimmed = code.trim().toUpperCase();

    // Extract booking ID from code format USH-{first8chars}
    const match = trimmed.match(/^USH-([A-F0-9]{8})$/i);
    if (!match) {
      setError("Ogiltigt kodformat. Förväntat: USH-XXXXXXXX");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(
        `/api/tickets/verify?code=${encodeURIComponent(trimmed)}&id=${match[1]}`
      );
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Kunde inte verifiera biljett");
      } else {
        setResult(data);
      }
    } catch {
      setError("Nätverksfel. Försök igen.");
    }
    setLoading(false);
  }

  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Skanna biljetter</h1>
        <p className="mt-1 text-sm text-[var(--usha-muted)]">
          Ange biljettkoden för att verifiera.
        </p>
      </div>

      <form onSubmit={handleVerify} className="mb-6 space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--usha-muted)]"
            />
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="USH-A1B2C3D4"
              className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] py-3 pl-10 pr-4 font-mono text-sm uppercase outline-none transition focus:border-[var(--usha-gold)]/40"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-5 py-3 text-sm font-bold text-black transition hover:opacity-90 disabled:opacity-50"
          >
            <Camera size={16} />
            {loading ? "..." : "Verifiera"}
          </button>
        </div>
      </form>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-center">
          <XCircle size={32} className="mx-auto mb-2 text-red-400" />
          <p className="font-semibold text-red-400">Ogiltig</p>
          <p className="mt-1 text-sm text-[var(--usha-muted)]">{error}</p>
        </div>
      )}

      {result && (
        <div
          className={`rounded-xl border p-6 text-center ${
            result.valid
              ? "border-green-500/20 bg-green-500/10"
              : "border-red-500/20 bg-red-500/10"
          }`}
        >
          {result.valid ? (
            <>
              <CheckCircle size={48} className="mx-auto mb-3 text-green-400" />
              <p className="text-lg font-bold text-green-400">Giltig biljett</p>
            </>
          ) : (
            <>
              <XCircle size={48} className="mx-auto mb-3 text-red-400" />
              <p className="text-lg font-bold text-red-400">Ogiltig biljett</p>
            </>
          )}

          <div className="mt-4 space-y-2 text-sm">
            <p className="font-semibold">{result.ticket.title}</p>
            <p className="text-[var(--usha-muted)]">
              Kod: <span className="font-mono">{result.ticket.code}</span>
            </p>
            {result.ticket.date && (
              <p className="text-[var(--usha-muted)]">
                Datum: {new Date(result.ticket.date).toLocaleDateString("sv-SE")}
                {result.ticket.time && ` kl ${result.ticket.time.slice(0, 5)}`}
              </p>
            )}
            {result.ticket.location && (
              <p className="text-[var(--usha-muted)]">
                Plats: {result.ticket.location}
              </p>
            )}
            <p className="text-xs text-[var(--usha-muted)]">
              Status: {result.status}
            </p>
          </div>

          <button
            onClick={() => {
              setResult(null);
              setCode("");
            }}
            className="mt-4 rounded-xl border border-[var(--usha-border)] px-6 py-2 text-sm transition hover:bg-[var(--usha-card)]"
          >
            Skanna nästa
          </button>
        </div>
      )}
    </div>
  );
}
