"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Loader2, X, AlertTriangle } from "lucide-react";

/**
 * Bekräfta / Avvisa för ett Swish-köp. Postar till samma rutt som dörrens
 * knappar (entry/swish/confirm), så grinden och logiken är densamma.
 */
export function SwishConfirmForm({
  listingId,
  bookingId,
  checkInDefault,
  preselected,
  checkText,
}: {
  listingId: string;
  bookingId: string;
  checkInDefault: boolean;
  preselected: boolean;
  checkText: string;
}) {
  const t = useTranslations("entrance");
  const [checkIn, setCheckIn] = useState(checkInDefault);
  const [busy, setBusy] = useState<"confirm" | "reject" | null>(null);
  const [done, setDone] = useState<"confirmed" | "checkedIn" | "rejected" | "closed" | null>(null);
  const [error, setError] = useState(false);

  async function decide(action: "confirm" | "reject") {
    if (busy || done) return;
    setBusy(action);
    setError(false);
    try {
      const res = await fetch(`/api/events/${listingId}/entry/swish/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, action, checkIn: action === "confirm" && checkIn, via: "notice" }),
      });
      if (res.status === 409) {
        setDone("closed");
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { status?: string; checkedIn?: boolean };
      setDone(data.status === "canceled" ? "rejected" : data.checkedIn ? "checkedIn" : "confirmed");
    } catch {
      setError(true);
    } finally {
      setBusy(null);
    }
  }

  if (done) {
    const text =
      done === "rejected"
        ? t("swishConfirmRejectedDone")
        : done === "checkedIn"
          ? t("swishConfirmDoneCheckedIn")
          : done === "confirmed"
            ? t("swishConfirmDone")
            : t("swishConfirmAlreadyClosed");
    return (
      <p
        role="status"
        className={`mt-6 rounded-2xl border p-5 text-sm font-medium ${
          done === "rejected" || done === "closed"
            ? "border-[var(--usha-border)] bg-[var(--usha-card)]"
            : "border-green-500/50 bg-green-500/10 text-green-400"
        }`}
      >
        {text}
      </p>
    );
  }

  return (
    <div className="mt-6">
      <p className="flex gap-2 rounded-2xl border border-[var(--usha-gold)]/40 bg-[var(--usha-gold)]/5 p-4 text-sm leading-relaxed">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[var(--usha-gold)]" />
        <span>{checkText}</span>
      </p>
      {preselected && <p className="mt-3 text-sm text-[var(--usha-muted)]">{t("swishConfirmChosen")}</p>}

      <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-[var(--usha-muted)]">
        <input
          type="checkbox"
          checked={checkIn}
          onChange={(e) => setCheckIn(e.target.checked)}
          className="h-5 w-5 accent-[var(--usha-gold)]"
        />
        {t("swishPendingCheckIn")}
      </label>

      <div className="mt-5 grid gap-3">
        <button
          type="button"
          autoFocus={preselected}
          onClick={() => decide("confirm")}
          disabled={busy !== null}
          className={`flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--usha-gold)] py-5 text-lg font-bold text-black disabled:opacity-60 ${
            preselected ? "ring-4 ring-[var(--usha-gold)]/40" : ""
          }`}
        >
          {busy === "confirm" ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
          {t("swishPendingConfirm")}
        </button>
        <button
          type="button"
          onClick={() => decide("reject")}
          disabled={busy !== null}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--usha-border)] py-5 text-lg font-semibold text-[var(--usha-muted)] transition hover:border-red-400/60 hover:text-red-400 disabled:opacity-60"
        >
          {busy === "reject" ? <Loader2 size={20} className="animate-spin" /> : <X size={20} />}
          {t("swishPendingReject")}
        </button>
      </div>
      {error && <p className="mt-3 text-center text-sm text-red-400">{t("swishConfirmError")}</p>}
    </div>
  );
}
