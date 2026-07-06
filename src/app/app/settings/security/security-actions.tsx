"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { updateLoginEmail } from "@/app/(dashboard)/dashboard/profile/actions";

export function ChangeLoginEmail({ currentEmail }: { currentEmail: string }) {
  const t = useTranslations("security");
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    setLoading(true);
    setError(null);
    const res = await updateLoginEmail(email);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setSent(true);
    setEditing(false);
    setEmail("");
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-[var(--usha-border)] bg-[var(--usha-black)]/20 px-3 py-2 text-sm">
        {currentEmail}
      </div>

      {sent && (
        <div className="rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-2 text-sm text-green-400">
          {t("emailChangeSent")}
        </div>
      )}

      {!editing ? (
        <button
          onClick={() => {
            setEditing(true);
            setSent(false);
          }}
          className="rounded-xl bg-[var(--usha-border)] px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--usha-border)]/70"
        >
          {t("changeLoginEmail")}
        </button>
      ) : (
        <div className="space-y-3 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4">
          <div>
            <label htmlFor="new-login-email" className="block text-sm text-[var(--usha-muted)] mb-1.5">
              {t("newLoginEmail")}
            </label>
            <input
              id="new-login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("newLoginEmailPlaceholder")}
              autoComplete="email"
              className="w-full rounded-lg border border-[var(--usha-border)] bg-[var(--usha-card)] px-3 py-2 text-sm outline-none focus:border-[var(--usha-gold)] transition-colors"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={submit}
              disabled={!email || loading}
              className="rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t("saving") : t("sendConfirmation")}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setEmail("");
                setError(null);
              }}
              className="rounded-xl px-4 py-2 text-sm text-[var(--usha-muted)] transition-colors hover:text-[var(--usha-white)]"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
