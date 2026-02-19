"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setStatus("Loggar in...");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        setStatus("");
        setLoading(false);
        return;
      }

      if (data.session) {
        setStatus("Inloggad! Omdirigerar...");
        window.location.href = "/app";
      } else {
        setError("Ingen session returnerad. Kontrollera din email.");
        setLoading(false);
      }
    } catch (err: any) {
      setError("Oväntat fel: " + (err?.message || String(err)));
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/callback` },
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--usha-gold)] to-[var(--usha-accent)]">
            <span className="text-lg font-bold text-black">U</span>
          </div>
          <h1 className="text-2xl font-bold">Välkommen tillbaka</h1>
          <p className="mt-1 text-sm text-[var(--usha-muted)]">
            Logga in på ditt konto
          </p>
        </div>

        <button
          onClick={handleGoogleLogin}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--usha-border)] py-3 text-sm font-medium transition hover:bg-[var(--usha-card)]"
        >
          Fortsätt med Google
        </button>

        <div className="mb-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-[var(--usha-border)]" />
          <span className="text-xs text-[var(--usha-muted)]">eller</span>
          <div className="h-px flex-1 bg-[var(--usha-border)]" />
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm text-[var(--usha-muted)]">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="demo@usha.se"
              className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-[var(--usha-muted)]">
              Lösenord
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="demo1234"
              className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
              required
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          )}
          {status && (
            <p className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-400">
              {status}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] py-3 text-sm font-bold text-black transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Loggar in..." : "Logga in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--usha-muted)]">
          Inget konto?{" "}
          <a
            href="/signup"
            className="text-[var(--usha-gold)] hover:underline"
          >
            Registrera dig
          </a>
        </p>
      </div>
    </div>
  );
}
