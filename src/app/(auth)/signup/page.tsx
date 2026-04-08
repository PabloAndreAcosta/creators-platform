"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Palette, Store, Search, ShieldCheck, Loader2 } from "lucide-react";

type Role = "creator" | "experience" | "customer";

const ROLES: { value: Role; label: string; description: string; icon: typeof Palette }[] = [
  { value: "creator", label: "Kreatör", description: "Jag erbjuder kreativa tjänster", icon: Palette },
  { value: "experience", label: "Upplevelse", description: "Jag driver en verksamhet", icon: Store },
  { value: "customer", label: "Kund", description: "Jag vill boka upplevelser", icon: Search },
];

const BANKID_ERRORS: Record<string, string> = {
  failed: "BankID-verifieringen misslyckades. Försök igen.",
  aborted: "BankID-verifieringen avbröts.",
  duplicate: "Det finns redan ett konto med detta personnummer.",
  error: "Ett fel uppstod vid verifieringen. Försök igen.",
};

const NEEDS_BANKID: Role[] = ["creator", "experience"];

function FieldError({ message }: { message: string }) {
  return <p className="mt-1 text-xs text-red-400">{message}</p>;
}

export default function SignupPage() {
  const searchParams = useSearchParams();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
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

  // BankID state
  const [bankidVerified, setBankidVerified] = useState(false);
  const [bankidSkipped, setBankidSkipped] = useState(false);
  const [bankidVerifying, setBankidVerifying] = useState(false);
  const [bankidError, setBankidError] = useState("");
  const [bankidData, setBankidData] = useState<{
    name: string;
    firstName: string;
    lastName: string;
    role: string;
  } | null>(null);

  const supabase = createClient();

  // Handle BankID callback from URL params
  useEffect(() => {
    const bankidStatus = searchParams.get("bankid");
    if (!bankidStatus) return;

    if (bankidStatus === "success") {
      // Fetch verified data from server
      fetch("/api/auth/bankid/verified-data")
        .then((res) => res.json())
        .then((data) => {
          if (data.error) {
            setBankidError("Verifieringsdata kunde inte hämtas. Försök igen.");
            return;
          }
          setBankidData(data);
          setBankidVerified(true);
          setFullName(data.name);
          setSelectedRole(data.role as Role);
        })
        .catch(() => {
          setBankidError("Verifieringsdata kunde inte hämtas. Försök igen.");
        });
    } else {
      setBankidError(BANKID_ERRORS[bankidStatus] || BANKID_ERRORS.error);
      // Restore role from localStorage if available
      const savedRole = localStorage.getItem("signup_role");
      if (savedRole && ["creator", "experience"].includes(savedRole)) {
        setSelectedRole(savedRole as Role);
      }
    }
  }, [searchParams]);

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

  async function handleBankIdVerify() {
    if (!selectedRole) return;
    setBankidVerifying(true);
    setBankidError("");

    // Save role so we can restore it after redirect
    localStorage.setItem("signup_role", selectedRole);

    try {
      const res = await fetch("/api/auth/bankid/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: selectedRole }),
      });
      const data = await res.json();

      if (data.error) {
        setBankidError(data.error);
        setBankidVerifying(false);
        return;
      }

      // Redirect to Signicat BankID
      window.location.href = data.authenticationUrl;
    } catch {
      setBankidError("Kunde inte starta BankID-verifiering. Försök igen.");
      setBankidVerifying(false);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();

    // For BankID roles, name comes from BankID — skip name validation
    const nErr = bankidVerified ? "" : validateName(fullName);
    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    setNameError(nErr);
    setEmailError(eErr);
    setPasswordError(pErr);
    if (!bankidVerified) setNameTouched(true);
    setEmailTouched(true);
    setPasswordTouched(true);
    if (nErr || eErr || pErr) return;

    setLoading(true);
    setError("");

    const refCode = searchParams.get("ref");
    const metadata: Record<string, string> = {
      full_name: fullName,
      role: selectedRole!,
      ...(refCode ? { referred_by_code: refCode.toUpperCase() } : {}),
    };

    // Include BankID data if verified
    if (bankidVerified && bankidData) {
      try {
        const verifiedRes = await fetch("/api/auth/bankid/verified-data");
        const verified = await verifiedRes.json();
        if (!verified.error) {
          metadata.bankid_verified_at = new Date().toISOString();
          metadata.bankid_name = verified.name;
          metadata.bankid_personal_number = verified.hashedNin;
        }
      } catch {
        // Continue with what we have
      }
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
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

  function storeRoleForOAuth() {
    document.cookie = `pending_role=${selectedRole};path=/;max-age=600;SameSite=Lax`;
  }

  async function handleGoogleSignup() {
    if (!selectedRole) return;
    storeRoleForOAuth();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/callback`,
        queryParams: { prompt: "select_account" },
      },
    });
  }

  async function handleFacebookSignup() {
    if (!selectedRole) return;
    storeRoleForOAuth();
    await supabase.auth.signInWithOAuth({
      provider: "facebook",
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

  // Step 1: Role selection
  if (!selectedRole && !bankidVerified) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--usha-gold)] to-[var(--usha-accent)]">
              <span className="text-lg font-bold text-black">U</span>
            </div>
            <h1 className="text-2xl font-bold">Välj din roll</h1>
            <p className="mt-1 text-sm text-[var(--usha-muted)]">Hur vill du använda Usha?</p>
          </div>

          <div className="space-y-3">
            {ROLES.map((role) => (
              <button
                key={role.value}
                onClick={() => setSelectedRole(role.value)}
                className="flex w-full items-center gap-4 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5 text-left transition hover:border-[var(--usha-gold)]/40"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--usha-gold)]/10">
                  <role.icon size={24} className="text-[var(--usha-gold)]" />
                </div>
                <div>
                  <h3 className="font-semibold">{role.label}</h3>
                  <p className="text-sm text-[var(--usha-muted)]">{role.description}</p>
                </div>
              </button>
            ))}
          </div>

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

  // Step 1.5: BankID verification (only for creator/experience, before registration)
  if (selectedRole && NEEDS_BANKID.includes(selectedRole) && !bankidVerified && !bankidSkipped) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--usha-gold)]/20 to-[var(--usha-accent)]/20">
              <ShieldCheck size={28} className="text-[var(--usha-gold)]" />
            </div>
            <h1 className="text-2xl font-bold">Verifiera din identitet</h1>
            <p className="mt-2 text-sm text-[var(--usha-muted)]">
              Som {ROLES.find((r) => r.value === selectedRole)?.label.toLowerCase()} behöver du verifiera dig med Mobilt BankID innan du skapar konto.
            </p>
          </div>

          {bankidError && (
            <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {bankidError}
            </div>
          )}

          <button
            onClick={handleBankIdVerify}
            disabled={bankidVerifying}
            className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] py-3 text-sm font-bold text-black transition hover:opacity-90 disabled:opacity-50"
          >
            {bankidVerifying ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Öppnar BankID...
              </>
            ) : (
              <>
                <ShieldCheck size={18} />
                Verifiera med Mobilt BankID
              </>
            )}
          </button>

          <p className="mt-3 text-center text-xs text-[var(--usha-muted)]">
            Du kommer att skickas till BankID för identifiering.
          </p>

          <button
            onClick={() => setBankidSkipped(true)}
            className="mt-6 block w-full text-center text-sm text-[var(--usha-muted)] hover:text-white hover:underline"
          >
            Hoppa över — verifiera senare
          </button>

          <button
            onClick={() => {
              setSelectedRole(null);
              setBankidError("");
            }}
            className="mt-3 block w-full text-center text-xs text-[var(--usha-gold)] hover:underline"
          >
            Byt roll
          </button>

          <p className="mt-4 text-center text-sm text-[var(--usha-muted)]">
            Har redan konto?{" "}
            <a href="/login" className="text-[var(--usha-gold)] hover:underline">
              Logga in
            </a>
          </p>
        </div>
      </div>
    );
  }

  // Step 2: Registration form
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--usha-gold)] to-[var(--usha-accent)]">
            <span className="text-lg font-bold text-black">U</span>
          </div>
          <h1 className="text-2xl font-bold">Skapa konto</h1>
          <p className="mt-1 text-sm text-[var(--usha-muted)]">
            {ROLES.find((r) => r.value === selectedRole)?.label} — 14 dagars gratis provperiod
          </p>
          {bankidVerified && (
            <p className="mt-1 flex items-center justify-center gap-1 text-xs text-green-400">
              <ShieldCheck size={12} /> Identitet verifierad med BankID
            </p>
          )}
          {!bankidVerified && (
            <button
              onClick={() => {
                setSelectedRole(null);
                setBankidError("");
              }}
              className="mt-1 text-xs text-[var(--usha-gold)] hover:underline"
            >
              Byt roll
            </button>
          )}
        </div>

        {/* OAuth buttons — only available after BankID for creator/experience */}
        {(!NEEDS_BANKID.includes(selectedRole!) || bankidVerified) && (
          <>
            <button
              onClick={handleGoogleSignup}
              className="mb-2 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-[var(--usha-border)] py-3 text-sm font-medium transition hover:bg-[var(--usha-card)]"
            >
              Fortsätt med Google
            </button>

            <button
              onClick={handleFacebookSignup}
              className="mb-4 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-[var(--usha-border)] py-3 text-sm font-medium transition hover:bg-[var(--usha-card)]"
            >
              Fortsätt med Facebook
            </button>

            <div className="mb-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-[var(--usha-border)]" />
              <span className="text-xs text-[var(--usha-muted)]">eller</span>
              <div className="h-px flex-1 bg-[var(--usha-border)]" />
            </div>
          </>
        )}

        <form onSubmit={handleSignup} className="space-y-4" noValidate>
          <div>
            <label className="mb-1.5 block text-sm text-[var(--usha-muted)]">Namn</label>
            {bankidVerified ? (
              <div className="flex items-center gap-2 rounded-xl border border-green-500/30 bg-[var(--usha-card)] px-4 py-3 text-base sm:text-sm">
                <ShieldCheck size={14} className="shrink-0 text-green-400" />
                <span>{fullName}</span>
              </div>
            ) : (
              <>
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
              </>
            )}
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
