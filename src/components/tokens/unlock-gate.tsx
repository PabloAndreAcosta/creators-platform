"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { KeyRound, ArrowRight } from "lucide-react";

/**
 * Low-key unlock affordance shown when a capability is locked for an event.
 * Offers spending nycklar (the token path) with "or upgrade" as the alternative
 * — never blocks the buyer flow, only the creator-side capability.
 */
export function UnlockGate({
  listingId,
  capability,
  cost,
  onUnlocked,
}: {
  listingId: string;
  capability: string;
  cost: number;
  onUnlocked?: () => void;
}) {
  const t = useTranslations("tokens");
  const [balance, setBalance] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);

  useEffect(() => {
    fetch("/api/tokens/balance")
      .then((r) => (r.ok ? r.json() : { balance: 0 }))
      .then((d) => setBalance(typeof d.balance === "number" ? d.balance : 0))
      .catch(() => setBalance(0));
  }, []);

  const canAfford = balance != null && balance >= cost;

  async function unlock() {
    setBusy(true);
    setErr(false);
    try {
      const res = await fetch("/api/tokens/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capability, listingId }),
      });
      if (res.ok) {
        onUnlocked?.();
      } else {
        setErr(true);
      }
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--usha-gold)] to-[var(--usha-accent)]">
        <KeyRound size={22} className="text-black" />
      </div>
      <h2 className="mb-1 text-xl font-bold">{t("unlock.title")}</h2>
      <p className="mb-5 text-sm text-[var(--usha-muted)]">{t("unlock.desc")}</p>

      <button
        onClick={unlock}
        disabled={busy || !canAfford}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-6 py-3 text-sm font-bold text-black transition hover:opacity-90 disabled:opacity-50"
      >
        <KeyRound size={15} />
        {busy ? t("unlock.unlocking") : `${t("unlock.button")} · ${t("unlock.cost", { cost })}`}
      </button>

      <p className="mt-2 text-xs text-[var(--usha-muted)]">
        {balance == null ? "" : t("unlock.youHave", { balance })}
      </p>

      {balance != null && !canAfford && (
        <p className="mt-2 text-xs text-[var(--usha-muted)]">{t("unlock.insufficient")}</p>
      )}
      {err && <p className="mt-2 text-xs text-red-400">{t("unlock.insufficient")}</p>}

      <div className="mt-5 flex flex-col items-center gap-2 text-xs">
        <Link href="/app/settings" className="text-[var(--usha-gold)] hover:underline">
          {t("unlock.buyMore")}
        </Link>
        <Link href="/dashboard/billing" className="inline-flex items-center gap-1 text-[var(--usha-muted)] hover:text-[var(--usha-white)]">
          {t("unlock.upgrade")} <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  );
}
