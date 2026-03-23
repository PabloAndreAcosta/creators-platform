"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deletePromoCode } from "./actions";

export function DeletePromoButton({ promoId }: { promoId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      onClick={() => {
        if (!confirm("Är du säker?")) return;
        startTransition(async () => { await deletePromoCode(promoId); });
      }}
      disabled={isPending}
      className="shrink-0 rounded-lg p-2 text-[var(--usha-muted)] transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
    >
      <Trash2 size={14} />
    </button>
  );
}
