"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

function FieldError({ message }: { message: string }) {
  return <p className="mt-1 text-xs text-red-400">{message}</p>;
}

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  const supabase = createClient();

  function validateName(value: string) {
    if (!value.trim()) return "Namn krävs";
    if (value.trim().length < 2) return "Minst 2 tecken";
    return "";
  }

  function validateEmail(value: string) {
    if (!value) return "E-postadress krävs";
    if (!value.includes("@") || !value.includes(".")) return "Ogiltig e-postadress";
    return "";
  }

  function validatePassword(value: string) {
    if (!value) return "Lösenord krävs";
    if (value.length < 8) return "Minst 8 tecken";
    return "";
  }

  function inputClass(touched: boolean, hasError: boolean) {
    const base =
      "w-full rounded-xl border bg-[var(--usha-card)] px-4 py-3 text-base sm:text-sm outline-none transition min-h-[44px]";
    if (!touched) return `${base} border-[var(--usha-border)] focus:border-[var(--usha-gold)]/40`;
    if (hasError) return `${base} border-red-500/60 focus:border-red-500/80`;
    return `${base} border-green-500/40 focus:border-green-500/60`;
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    const nErr = validateName(fullName);
    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    setNameError(nErr);
    setEmailError(eErr);
    setPasswordError(pErr);
    setNameTouched(true);
    setEmailTouched(true);
    setPasswordTouched(true);
    if (nErr || eErr || pErr) return;

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
      const msg =
        error.message === "User already registered"
          ? "Det finns redan ett konto med denna e-postadress"
          : error.message;
      setError(msg);
      setLoading(false);
      return;
    }

    if (data.session) {
      window.location.href = "/app";
      return;
    }

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
          className="mb-4 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-[var(--usha-border)] py-3 text-sm font-medium transition hover:bg-[var(--usha-card)]"
        >
          Fortsätt med Google
        </button>

        <div className="mb-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-[var(--usha-border)]" />
          <span className="text-xs text-[var(--usha-muted)]">eller</span>
          <div className="h-px flex-1 bg-[var(--usha-border)]" />
        </div>

        <form onSubmit={handleSignup} className="space-y-4" noValidate>
          <div>
            <label className="mb-1.5 block text-sm text-[var(--usha-muted)]">Namn</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (nameTouched) setNameError(validateName(e.target.value));
              }}
              onBlur={() => {
                setNameTouched(true);
                setNameError(validateName(fullName));
              }}
              autoComplete="name"
              className={inputClass(nameTouched, !!nameError)}
            />
            {nameTouched && nameError && <FieldError message={nameError} />}
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-[var(--usha-muted)]">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailTouched) setEmailError(validateEmail(e.target.value));
              }}
              onBlur={() => {
                setEmailTouched(true);
                setEmailError(validateEmail(email));
              }}
              autoCapitalize="none"
              autoComplete="email"
              className={inputClass(emailTouched, !!emailError)}
            />
            {emailTouched && emailError && <FieldError message={emailError} />}
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-[var(--usha-muted)]">Lösenord</label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordTouched) setPasswordError(validatePassword(e.target.value));
              }}
              onBlur={() => {
                setPasswordTouched(true);
                setPasswordError(validatePassword(password));
              }}
              autoComplete="new-password"
              className={inputClass(passwordTouched, !!passwordError)}
            />
            {passwordTouched && passwordError && <FieldError message={passwordError} />}
            {passwordTouched && !passwordError && password && (
              <p className="mt-1 text-xs text-green-400">Lösenord ser bra ut</p>
            )}
          </div>

          {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[44px] rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] py-3 text-sm font-bold text-black transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Skapar konto..." : "Skapa konto"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--usha-muted)]">
          Har redan konto?{" "}
          <a href="/login" className="text-[var(--usha-gold)] hover:underline">
            Logga in
          </a>
        </p>
      </div>
    </div>
  );
}
