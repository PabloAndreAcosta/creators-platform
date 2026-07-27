"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Banknote, Check, X } from "lucide-react";
import { useToast } from "@/components/ui/toaster";
import { gageKr, gageStatusLabel, GAGE_MIN_SEK, type GageStatus, type GageProposedBy } from "@/lib/gage";

export interface GageView {
  id: string;
  amount_ore: number;
  status: GageStatus;
  proposed_by: GageProposedBy;
  note: string | null;
}

export function GagePanel({
  listingId,
  perspective,
  collaboratorUserId,
  agreement,
  payeeConnected = true,
}: {
  listingId: string;
  perspective: "host" | "crew";
  collaboratorUserId?: string; // required for host proposing
  agreement: GageView | null;
  payeeConnected?: boolean; // host view: does the crew member have Stripe?
}) {
  const t = useTranslations("gagePanel");
  const router = useRouter();
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const active = agreement && (agreement.status === "proposed" || agreement.status === "agreed");
  const iProposed =
    agreement &&
    ((perspective === "host" && agreement.proposed_by === "host") ||
      (perspective === "crew" && agreement.proposed_by === "crew"));

  async function call(url: string, body?: unknown) {
    setBusy(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? t("errorGeneric"));
        return null;
      }
      return data;
    } catch {
      toast.error(t("errorNetwork"));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function propose() {
    const sek = Number(amount);
    if (!Number.isInteger(sek) || sek < GAGE_MIN_SEK) {
      toast.error(t("errorAmount", { min: GAGE_MIN_SEK }));
      return;
    }
    const body: Record<string, unknown> = { amount_sek: sek };
    if (perspective === "host") body.collaborator_user_id = collaboratorUserId;
    const data = await call(`/api/listings/${listingId}/gage`, body);
    if (data) {
      toast.success(t("toastProposed"));
      setAmount("");
      router.refresh();
    }
  }

  async function accept() {
    if (await call(`/api/gage/${agreement!.id}/accept`)) {
      toast.success(t("toastAccepted"));
      router.refresh();
    }
  }
  async function cancel() {
    if (await call(`/api/gage/${agreement!.id}/cancel`)) {
      toast.success(t("toastCanceled"));
      router.refresh();
    }
  }
  async function pay() {
    const data = await call(`/api/gage/${agreement!.id}/pay`);
    if (data?.url) window.location.href = data.url;
  }

  // ---- render ----
  const label = (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--usha-muted)]">
      <Banknote size={13} /> {t("label")}
    </span>
  );

  if (agreement?.status === "paid") {
    return (
      <div className="mt-2 flex items-center justify-between rounded-lg bg-green-500/10 px-3 py-2">
        {label}
        <span className="text-xs font-semibold text-green-400">
          {gageStatusLabel("paid")} · {gageKr(agreement.amount_ore)}
        </span>
      </div>
    );
  }

  if (!active) {
    // Propose a new gage
    return (
      <div className="mt-2 flex items-center gap-2">
        {label}
        <input
          type="number"
          inputMode="numeric"
          min={GAGE_MIN_SEK}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={t("amountPlaceholder")}
          className="w-20 rounded-lg border border-[var(--usha-border)] bg-[var(--usha-black)] px-2 py-1.5 text-sm text-[var(--usha-white)] focus:border-[var(--usha-gold)] focus:outline-none"
        />
        <button
          onClick={propose}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--usha-border)] px-3 py-1.5 text-xs font-medium text-[var(--usha-white)] transition hover:border-[var(--usha-gold)]/60 disabled:opacity-50"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : null}
          {t("propose")}
        </button>
      </div>
    );
  }

  // proposed or agreed
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-[var(--usha-gold)]/5 px-3 py-2">
      {label}
      <span className="text-sm font-semibold text-[var(--usha-white)]">{gageKr(agreement!.amount_ore)}</span>
      <span className="text-[11px] text-[var(--usha-muted)]">· {gageStatusLabel(agreement!.status)}</span>

      <div className="ml-auto flex items-center gap-1.5">
        {agreement!.status === "proposed" && iProposed && (
          <button onClick={cancel} disabled={busy} className="rounded-lg px-2.5 py-1 text-xs text-[var(--usha-muted)] hover:text-red-400 disabled:opacity-50">
            {t("cancel")}
          </button>
        )}
        {agreement!.status === "proposed" && !iProposed && (
          <>
            <button onClick={accept} disabled={busy} className="inline-flex items-center gap-1 rounded-lg bg-[var(--usha-gold)] px-3 py-1 text-xs font-bold text-black disabled:opacity-50">
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} {t("accept")}
            </button>
            <button onClick={cancel} disabled={busy} className="rounded-lg p-1 text-[var(--usha-muted)] hover:text-red-400 disabled:opacity-50" aria-label={t("declineAria")}>
              <X size={14} />
            </button>
          </>
        )}
        {agreement!.status === "agreed" && perspective === "host" && (
          <button
            onClick={pay}
            disabled={busy || !payeeConnected}
            title={payeeConnected ? undefined : t("payeeNotConnectedTooltip")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-3 py-1 text-xs font-bold text-black disabled:opacity-50"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Banknote size={12} />}
            {t("pay", { amount: gageKr(agreement!.amount_ore) })}
          </button>
        )}
        {agreement!.status === "agreed" && perspective === "crew" && (
          <span className="text-[11px] text-[var(--usha-muted)]">{t("awaitingPayment")}</span>
        )}
        {agreement!.status === "agreed" && perspective === "host" && !payeeConnected && (
          <span className="text-[11px] text-amber-400">{t("notStripeConnected")}</span>
        )}
      </div>
    </div>
  );
}
