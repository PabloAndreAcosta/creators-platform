"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const supabase = createClient();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // If session exists, user is auto-confirmed — redirect immediately
    if (data.session) {
      window.location.href = "/app";
      return;
    }

    // Otherwise email confirmation is required
    setSuccess(true);
    setLoading(false);
  }

  async function handleGoogleSignup() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/callback` },
    });
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <div className="mb-4 text-4xl">📧</div>
          <h1 className="text-2xl font-bold">Kolla din mail</h1>
          <p className="mt-2 text-sm text-[var(--usha-muted)]">
            Vi har skickat en bekräftelselänk till <strong>{email}</strong>.
            Klicka på länken för att aktivera ditt konto.
          </p>
          <a
            href="/login"
            className="mt-6 inline-block text-sm text-[var(--usha-gold)] hover:underline"
          >
            Tillbaka till login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--usha-gold)] to-[var(--usha-accent)]">
            <span className="text-lg font-bold text-black">U</span>
          </div>
          <h1 className="text-2xl font-bold">Skapa konto</h1>
          <p className="mt-1 text-sm text-[var(--usha-muted)]">14 dagars gratis provperiod</p>
        </div>

        <button
          onClick={handleGoogleSignup}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--usha-border)] py-3 text-sm font-medium transition hover:bg-[var(--usha-card)]"
        >
          Fortsätt med Google
        </button>

        <div className="mb-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-[var(--usha-border)]" />
          <span className="text-xs text-[var(--usha-muted)]">eller</span>
          <div className="h-px flex-1 bg-[var(--usha-border)]" />
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm text-[var(--usha-muted)]">Namn</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-[var(--usha-muted)]">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-[var(--usha-muted)]">Lösenord</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
              minLength={6}
              required
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] py-3 text-sm font-bold text-black transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Skapar konto..." : "Skapa konto"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--usha-muted)]">
          Har redan konto?{" "}
          <a href="/login" className="text-[var(--usha-gold)] hover:underline">Logga in</a>
        </p>
      </div>
    </div>
  );
}
