"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { deletePromoCode } from "./actions";

export function DeletePromoButton({ promoId }: { promoId: string }) {
  const t = useTranslations("promoCodes");
  const [isPending, startTransition] = useTransition();

  return (
    <button
      onClick={() => {
        if (!confirm(t("confirmDelete"))) return;
        startTransition(async () => { await deletePromoCode(promoId); });
      }}
      disabled={isPending}
      className="shrink-0 rounded-lg p-2 text-[var(--usha-muted)] transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
    >
      <Trash2 size={14} />
    </button>
  );
}
