"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { ShieldCheck, Eye, EyeOff } from "lucide-react";
import UschjaLogo from "@/components/UschjaLogo";

function FieldError({ message }: { message: string }) {
  return <p className="mt-1 text-xs text-red-400">{message}</p>;
}

export default function LoginPage() {
  const t = useTranslations("auth");
  const searchParams = useSearchParams();
  const bankidPending = searchParams.get("bankid_pending") === "1";
  const prefilledEmail = searchParams.get("email") || "";
  const rawNext = searchParams.get("next") || "";
  const nextPath = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/app";
  const [email, setEmail] = useState(prefilledEmail);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (prefilledEmail) setEmail(prefilledEmail);
  }, [prefilledEmail]);

  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  const supabase = createClient();

  // Self-heal a stuck session: if a stale/revoked token is being auto-refreshed
  // in the background it hammers /token (→ per-IP rate limit) and holds the auth
  // lock, locking the user out of login itself. Just landing on this page purges
  // it — scope "local" clears storage WITHOUT a network call (so it can't hit the
  // rate limit) and stops the auto-refresh ticker. Safe here: you're logging in.
  useEffect(() => {
    supabase.auth.signOut({ scope: "local" }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function validateEmail(value: string) {
    if (!value) return t("emailRequired");
    if (!value.includes("@") || !value.includes(".")) return t("emailInvalid");
    return "";
  }

  function validatePassword(value: string) {
    if (!value) return t("passwordRequired");
    if (value.length < 8) return t("passwordMinLength");
    return "";
  }

  function handleEmailChange(value: string) {
    setEmail(value);
    if (emailTouched) setEmailError(validateEmail(value));
  }

  function handlePasswordChange(value: string) {
    setPassword(value);
    if (passwordTouched) setPasswordError(validatePassword(value));
  }

  function inputClass(touched: boolean, hasError: boolean) {
    const base =
      "w-full rounded-xl border bg-[var(--usha-card)] px-4 py-3 text-base sm:text-sm outline-none transition min-h-[44px]";
    if (!touched) return `${base} border-[var(--usha-border)] focus:border-[var(--usha-gold)]/40`;
    if (hasError) return `${base} border-red-500/60 focus:border-red-500/80`;
    return `${base} border-green-500/40 focus:border-green-500/60`;
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    setEmailError(eErr);
    setPasswordError(pErr);
    setEmailTouched(true);
    setPasswordTouched(true);
    if (eErr || pErr) return;

    setLoading(true);
    setError("");
    setStatus(t("loggingIn"));

    try {
      // Clear any existing session first so logging in with a *different* account
      // always switches cleanly, AND so a stale/revoked token isn't being auto-
      // refreshed in the background (which holds the auth-token Web Lock and made
      // signInWithPassword fail with "another request stole it"). Use scope:
      // "local" — it purges local storage WITHOUT a network call, so it can't hit
      // the auth rate limit, and swallow any lock error so it never aborts login.
      await supabase.auth.signOut({ scope: "local" }).catch(() => {});
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        const msg =
          error.message === "Invalid login credentials"
            ? t("wrongCredentials")
            : error.message;
        setError(msg);
        setStatus("");
        setLoading(false);
        return;
      }

      if (data.session) {
        setStatus(t("loggedInRedirecting"));
        // If user came here from signup with a BankID-verified cookie still set,
        // apply that verification to their existing account before redirecting.
        // 400/404 means no cookie — that's expected for normal logins.
        try {
          await fetch("/api/auth/signup/apply-verification", { method: "POST" });
        } catch {
          /* non-fatal */
        }
        window.location.href = nextPath;
      } else {
        setError(t("noSessionReturned"));
        setLoading(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(t("unexpectedError") + msg);
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    // Purge any stale/revoked session first (see handleLogin) so its background
    // token refresh doesn't hold the auth lock and block the OAuth redirect.
    await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/callback`,
        queryParams: { prompt: "select_account" },
      },
    });
  }

  async function handleFacebookLogin() {
    await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    await supabase.auth.signInWithOAuth({
      provider: "facebook",
      options: { redirectTo: `${window.location.origin}/callback` },
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <UschjaLogo size={80} />
          </div>
          <h1 className="text-2xl font-bold">{t("welcomeBack")}</h1>
          <p className="mt-1 text-sm text-[var(--usha-muted)]">{t("loginToAccount")}</p>
        </div>

        {bankidPending && (
          <div className="mb-6 rounded-lg border border-[var(--usha-gold)]/30 bg-[var(--usha-gold)]/5 px-4 py-3 text-sm">
            <p className="flex items-center gap-2 font-semibold text-[var(--usha-gold)]">
              <ShieldCheck size={14} /> BankID-verifiering väntar
            </p>
            <p className="mt-1 text-[var(--usha-muted)]">
              Logga in på ditt befintliga konto så aktiveras kreatörsverifieringen
              automatiskt.
            </p>
          </div>
        )}

        <button
          onClick={handleGoogleLogin}
          className="mb-2 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-[var(--usha-border)] py-3 text-sm font-medium transition hover:bg-[var(--usha-card)]"
        >
          {t("continueWithGoogle")}
        </button>

        <button
          onClick={handleFacebookLogin}
          className="mb-4 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-[var(--usha-border)] py-3 text-sm font-medium transition hover:bg-[var(--usha-card)]"
        >
          {t("continueWithFacebook")}
        </button>

        <div className="mb-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-[var(--usha-border)]" />
          <span className="text-xs text-[var(--usha-muted)]">{t("or")}</span>
          <div className="h-px flex-1 bg-[var(--usha-border)]" />
        </div>

        <form onSubmit={handleLogin} className="space-y-4" noValidate>
          <div>
            <label className="mb-1.5 block text-sm text-[var(--usha-muted)]">{t("email")}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              onBlur={() => {
                setEmailTouched(true);
                setEmailError(validateEmail(email));
              }}
              placeholder="din@email.com"
              autoCapitalize="none"
              autoComplete="email"
              className={inputClass(emailTouched, !!emailError)}
            />
            {emailTouched && emailError && <FieldError message={emailError} />}
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-[var(--usha-muted)]">{t("password")}</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                onBlur={() => {
                  setPasswordTouched(true);
                  setPasswordError(validatePassword(password));
                }}
                placeholder="••••••••"
                autoComplete="current-password"
                className={`${inputClass(passwordTouched, !!passwordError)} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-[var(--usha-muted)] transition hover:text-[var(--usha-white)]"
                aria-label={showPassword ? t("hidePassword") : t("showPassword")}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {passwordTouched && passwordError && <FieldError message={passwordError} />}
          </div>

          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
          )}
          {status && (
            <p className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-400">{status}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[44px] rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] py-3 text-sm font-bold text-black transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? t("loggingIn") : t("logIn")}
          </button>
        </form>

        <p className="mt-3 text-center">
          <a href="/forgot-password" className="text-sm text-[var(--usha-muted)] hover:text-[var(--usha-gold)] transition-colors">
            {t("forgotPassword")}
          </a>
        </p>

        <p className="mt-6 text-center text-sm text-[var(--usha-muted)]">
          {t("noAccount")}{" "}
          <a href="/signup" className="text-[var(--usha-gold)] hover:underline">
            {t("signUp")}
          </a>
        </p>
      </div>
    </div>
  );
}
