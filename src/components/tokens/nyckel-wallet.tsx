"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { KeyRound } from "lucide-react";
import { NYCKEL_PACKAGES } from "@/lib/tokens/config";
import { monthlyAllowance } from "@/lib/tokens/allowance";
import { useSubscription } from "@/lib/subscription/context";

/** Low-key wallet: shows the user's nyckel balance + lets them buy a package.
 *  Not a hard sell — a quiet alternative to the subscription tiers. */
export function NyckelWallet() {
  const t = useTranslations("tokens");
  const { tier } = useSubscription();
  const allowance = monthlyAllowance(tier);
  const [balance, setBalance] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/tokens/balance")
      .then((r) => (r.ok ? r.json() : { balance: 0 }))
      .then((d) => setBalance(typeof d.balance === "number" ? d.balance : 0))
      .catch(() => setBalance(0));
  }, []);

  async function buy(packageId: string) {
    setBusy(packageId);
    try {
      const res = await fetch("/api/tokens/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.url) window.location.href = data.url;
      else setBusy(null);
    } catch {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4">
      <div className="mb-3 flex items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--usha-border)]">
          <KeyRound size={18} className="text-[var(--usha-muted)]" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{t("title")}</p>
          <p className="text-xs text-[var(--usha-muted)]">{t("desc")}</p>
        </div>
      </div>

      <p className="text-sm">
        {balance === null ? t("loading") : t("balance", { count: balance })}
      </p>
      {allowance > 0 && (
        <p className="mb-3 mt-0.5 text-xs text-[var(--usha-muted)]">
          {t("allowanceNote", { count: allowance })}
        </p>
      )}
      {allowance <= 0 && <div className="mb-3" />}

      <div className="flex flex-wrap gap-2">
        {NYCKEL_PACKAGES.map((p) => (
          <button
            key={p.id}
            onClick={() => buy(p.id)}
            disabled={!!busy}
            className="rounded-lg border border-[var(--usha-border)] px-3 py-1.5 text-xs font-medium transition hover:border-[var(--usha-gold)]/40 hover:text-[var(--usha-white)] disabled:opacity-50"
          >
            {busy === p.id ? t("loading") : `${t("buy")} ${p.tokens} · ${p.priceSek} kr`}
          </button>
        ))}
      </div>
    </div>
  );
}
