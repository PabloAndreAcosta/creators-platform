"use client";

import { useState, useTransition } from "react";
import { Trash2, ToggleLeft, ToggleRight, Copy, Check } from "lucide-react";
import { togglePromoCode, deletePromoCode } from "./actions";
import { useToast } from "@/components/ui/toaster";

interface PromoCode {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percent" | "fixed";
  discount_value: number;
  scope: string;
  max_uses: number | null;
  current_uses: number;
  max_uses_per_user: number;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
}

export function PromoTable({ promoCodes }: { promoCodes: PromoCode[] }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  function handleCopy(code: string, id: string) {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function handleToggle(id: string, currentActive: boolean) {
    startTransition(async () => {
      const result = await togglePromoCode(id, !currentActive);
      if (result.error) {
        toast.error("Fel", result.error);
      }
    });
  }

  function handleDelete(id: string, code: string) {
    if (!confirm(`Radera promokod "${code}"? Detta kan inte ångras.`)) return;
    startTransition(async () => {
      const result = await deletePromoCode(id);
      if (result.error) {
        toast.error("Fel", result.error);
      }
    });
  }

  if (promoCodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] py-16">
        <p className="text-sm text-[var(--usha-muted)]">Inga promokoder ännu.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--usha-border)]">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-[var(--usha-border)] bg-[var(--usha-card)]">
          <tr>
            <th className="px-4 py-3 font-medium text-[var(--usha-muted)]">Kod</th>
            <th className="px-4 py-3 font-medium text-[var(--usha-muted)]">Rabatt</th>
            <th className="px-4 py-3 font-medium text-[var(--usha-muted)]">Gäller för</th>
            <th className="px-4 py-3 font-medium text-[var(--usha-muted)]">Användningar</th>
            <th className="px-4 py-3 font-medium text-[var(--usha-muted)]">Giltig till</th>
            <th className="px-4 py-3 font-medium text-[var(--usha-muted)]">Status</th>
            <th className="px-4 py-3 font-medium text-[var(--usha-muted)]"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--usha-border)]">
          {promoCodes.map((promo) => {
            const isExpired = promo.valid_until && new Date(promo.valid_until) < new Date();
            const isExhausted = promo.max_uses !== null && promo.current_uses >= promo.max_uses;

            return (
              <tr key={promo.id} className="bg-[var(--usha-black)] transition-colors hover:bg-[var(--usha-card)]">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold tracking-wider">
                      {promo.code}
                    </span>
                    <button
                      onClick={() => handleCopy(promo.code, promo.id)}
                      className="rounded p-0.5 text-[var(--usha-muted)] transition-colors hover:text-white"
                    >
                      {copiedId === promo.id ? (
                        <Check size={12} className="text-emerald-400" />
                      ) : (
                        <Copy size={12} />
                      )}
                    </button>
                  </div>
                  {promo.description && (
                    <p className="mt-0.5 text-xs text-[var(--usha-muted)]">{promo.description}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="font-semibold text-[var(--usha-gold)]">
                    {promo.discount_type === "percent"
                      ? `${promo.discount_value}%`
                      : `${promo.discount_value} SEK`}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-[var(--usha-card)] px-2 py-0.5 text-xs">
                    {promo.scope === "both"
                      ? "Allt"
                      : promo.scope === "subscription"
                        ? "Prenumeration"
                        : "Biljetter"}
                  </span>
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {promo.current_uses}
                  {promo.max_uses !== null && (
                    <span className="text-[var(--usha-muted)]"> / {promo.max_uses}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs">
                  {promo.valid_until
                    ? new Date(promo.valid_until).toLocaleDateString("sv-SE")
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  {!promo.is_active ? (
                    <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-400">Inaktiv</span>
                  ) : isExpired ? (
                    <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-xs text-orange-400">Utgången</span>
                  ) : isExhausted ? (
                    <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-xs text-orange-400">Slut</span>
                  ) : (
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">Aktiv</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggle(promo.id, promo.is_active)}
                      disabled={isPending}
                      className="rounded p-1.5 text-[var(--usha-muted)] transition-colors hover:bg-[var(--usha-card)] hover:text-white disabled:opacity-50"
                      title={promo.is_active ? "Inaktivera" : "Aktivera"}
                    >
                      {promo.is_active ? <ToggleRight size={16} className="text-emerald-400" /> : <ToggleLeft size={16} />}
                    </button>
                    <button
                      onClick={() => handleDelete(promo.id, promo.code)}
                      disabled={isPending}
                      className="rounded p-1.5 text-[var(--usha-muted)] transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                      title="Radera"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
