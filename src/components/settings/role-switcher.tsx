"use client";

import { useEffect, useState } from "react";
import { Users, Sparkles, Building2, Loader2, Check } from "lucide-react";
import { useTranslations } from "next-intl";

type Role = "customer" | "creator" | "venue";
const ROLE_ORDER: Role[] = ["customer", "creator", "venue"];
const ICON: Record<Role, typeof Users> = { customer: Users, creator: Sparkles, venue: Building2 };

/**
 * Rollbytaren på kontosidan. Visar de tre rollerna med en rad om vad var
 * och en ger, markerar den nuvarande, och byter med ett klick plus en
 * bekräftelse. Efter bytet laddas appen om från startsidan, eftersom
 * menyer, flikar och startvyn alla följer rollen.
 */
export function RoleSwitcher() {
  const t = useTranslations("account");
  const [current, setCurrent] = useState<Role | null>(null);
  const [picked, setPicked] = useState<Role | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/account/role")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && d?.role && setCurrent(d.role as Role))
      .catch(() => alive && setError(t("roleLoadError")));
    return () => {
      alive = false;
    };
  }, [t]);

  async function confirmSwitch() {
    if (!picked || picked === current) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: picked }),
      });
      if (!res.ok) {
        setError(t("roleSwitchError"));
        setBusy(false);
        return;
      }
      // Hela appen formas av rollen: börja om från startsidan.
      window.location.href = "/app";
    } catch {
      setError(t("roleSwitchError"));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6">
      <div>
        <h2 className="text-lg font-semibold">{t("roleTitle")}</h2>
        <p className="mt-1 text-sm text-[var(--usha-muted)]">{t("roleLead")}</p>
      </div>

      {current === null && !error ? (
        <div className="flex items-center gap-2 text-sm text-[var(--usha-muted)]">
          <Loader2 size={14} className="animate-spin" /> {t("roleLoading")}
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-3">
          {ROLE_ORDER.map((role) => {
            const Icon = ICON[role];
            const isCurrent = role === current;
            const isPicked = role === (picked ?? current);
            return (
              <button
                key={role}
                type="button"
                onClick={() => setPicked(role)}
                disabled={busy}
                aria-pressed={isPicked}
                className={`flex flex-col items-start gap-1.5 rounded-xl border p-4 text-left transition ${
                  isPicked
                    ? "border-[var(--usha-gold)]/60 bg-[var(--usha-gold)]/10"
                    : "border-[var(--usha-border)] hover:border-[var(--usha-gold)]/30"
                }`}
              >
                <span className="flex w-full items-center justify-between">
                  <Icon size={18} className="text-[var(--usha-gold)]" />
                  {isCurrent && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--usha-gold)]/15 px-2 py-0.5 text-[10px] font-semibold text-[var(--usha-gold)]">
                      <Check size={10} /> {t("roleCurrent")}
                    </span>
                  )}
                </span>
                <span className="text-sm font-semibold">{t(`roleName.${role}`)}</span>
                <span className="text-xs leading-relaxed text-[var(--usha-muted)]">{t(`roleDesc.${role}`)}</span>
              </button>
            );
          })}
        </div>
      )}

      {picked && picked !== current && (
        <div className="space-y-3 rounded-lg border border-[var(--usha-border)] bg-[var(--usha-black)]/40 p-4">
          <p className="text-sm text-[var(--usha-muted)]">
            {t("roleConfirmBody", { role: t(`roleName.${picked}`) })}
          </p>
          {picked === "creator" && <p className="text-xs text-[var(--usha-muted)]">{t("roleNoteCreator")}</p>}
          {picked === "venue" && <p className="text-xs text-[var(--usha-muted)]">{t("roleNoteVenue")}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={confirmSwitch}
              disabled={busy}
              className="rounded-xl bg-[var(--usha-gold)] px-4 py-2.5 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? t("roleSwitching") : t("roleConfirm", { role: t(`roleName.${picked}`) })}
            </button>
            <button
              type="button"
              onClick={() => setPicked(null)}
              disabled={busy}
              className="rounded-xl border border-[var(--usha-border)] px-4 py-2.5 text-sm text-[var(--usha-muted)] transition hover:text-[var(--usha-white)]"
            >
              {t("roleCancel")}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
