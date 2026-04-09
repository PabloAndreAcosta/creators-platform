"use client";

import { useState } from "react";
import { Trash2, AlertTriangle, Shield } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useTranslations } from "next-intl";

export default function AccountSettingsPage() {
  const t = useTranslations("account");
  const tc = useTranslations("common");

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
        setError(data.error || tc("error"));
        setLoading(false);
        return;
      }

      await createClient().auth.signOut();
      window.location.href = "/";
    } catch {
      setError(t("unexpectedError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-[var(--usha-muted)] mt-1">
          {t("subtitle")}
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
              {t("deleteAccount")}
            </h2>
            <p className="text-sm text-[var(--usha-muted)]">
              {t("deleteAccountDesc")}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-lg bg-[var(--usha-card)] border border-[var(--usha-border)] p-4">
          <Shield className="h-5 w-5 text-[var(--usha-muted)] mt-0.5 shrink-0" />
          <p className="text-sm text-[var(--usha-muted)]">
            {t("gdprInfo")}
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-red-400">
            {t("dataToDelete")}
          </p>
          <ul className="grid grid-cols-2 gap-1.5 text-sm text-[var(--usha-muted)]">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              {t("profile")}
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              {t("bookings")}
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              {t("messages")}
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              {t("reviews")}
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              {t("notificationsData")}
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              {t("favorites")}
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              {t("servicesExperiences")}
            </li>
          </ul>
        </div>

        {!showConfirmation ? (
          <button
            onClick={() => setShowConfirmation(true)}
            className="mt-2 rounded-xl bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20"
          >
            {t("deleteMyAccount")}
          </button>
        ) : (
          <div className="mt-2 space-y-4 rounded-xl border border-red-500/20 bg-[var(--usha-card)] p-4">
            <div className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">
                {t("confirmDeletion")}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label
                  htmlFor="delete-password"
                  className="block text-sm text-[var(--usha-muted)] mb-1.5"
                >
                  {t("enterPassword")}
                </label>
                <input
                  id="delete-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("passwordPlaceholder")}
                  autoComplete="current-password"
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
                  {t("iUnderstand")}
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
                {loading ? t("deleting") : t("confirmDelete")}
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
                {tc("cancel")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
