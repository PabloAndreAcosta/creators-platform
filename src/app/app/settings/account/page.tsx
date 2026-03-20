"use client";

import { useState } from "react";
import { Trash2, AlertTriangle, Shield } from "lucide-react";

export default function AccountSettingsPage() {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!confirmed || !password) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Något gick fel.");
        setLoading(false);
        return;
      }

      window.location.href = "/";
    } catch {
      setError("Ett oväntat fel uppstod. Försök igen senare.");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Kontoinställningar</h1>
        <p className="text-[var(--usha-muted)] mt-1">
          Hantera ditt konto och dina data.
        </p>
      </div>

      {/* GDPR Delete Account Section */}
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
            <Trash2 className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-red-400">
              Radera konto
            </h2>
            <p className="text-sm text-[var(--usha-muted)]">
              Permanent radering av konto och data
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-lg bg-[var(--usha-card)] border border-[var(--usha-border)] p-4">
          <Shield className="h-5 w-5 text-[var(--usha-muted)] mt-0.5 shrink-0" />
          <p className="text-sm text-[var(--usha-muted)]">
            Enligt GDPR har du rätt att radera ditt konto och all tillhörande
            data. Denna åtgärd är permanent och kan inte ångras.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-red-400">
            Följande data kommer att raderas:
          </p>
          <ul className="grid grid-cols-2 gap-1.5 text-sm text-[var(--usha-muted)]">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              Profil
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              Bokningar
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              Meddelanden
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              Recensioner
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              Notifikationer
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              Favoriter
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              Tjänster/Upplevelser
            </li>
          </ul>
        </div>

        {!showConfirmation ? (
          <button
            onClick={() => setShowConfirmation(true)}
            className="mt-2 rounded-xl bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20"
          >
            Radera mitt konto
          </button>
        ) : (
          <div className="mt-2 space-y-4 rounded-xl border border-red-500/20 bg-[var(--usha-card)] p-4">
            <div className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">
                Bekräfta kontoradering
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label
                  htmlFor="delete-password"
                  className="block text-sm text-[var(--usha-muted)] mb-1.5"
                >
                  Ange ditt lösenord för att bekräfta
                </label>
                <input
                  id="delete-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ditt lösenord"
                  className="w-full rounded-lg border border-[var(--usha-border)] bg-[var(--usha-card)] px-3 py-2 text-sm outline-none focus:border-red-400 transition-colors"
                />
              </div>

              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-0.5 rounded border-[var(--usha-border)] accent-red-500"
                />
                <span className="text-sm text-[var(--usha-muted)]">
                  Jag förstår att detta inte kan ångras
                </span>
              </label>
            </div>

            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={handleDelete}
                disabled={!confirmed || !password || loading}
                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Raderar..." : "Bekräfta radering"}
              </button>
              <button
                onClick={() => {
                  setShowConfirmation(false);
                  setPassword("");
                  setConfirmed(false);
                  setError(null);
                }}
                className="rounded-xl px-4 py-2 text-sm text-[var(--usha-muted)] transition-colors hover:text-[var(--usha-foreground)]"
              >
                Avbryt
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
