"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteProduct } from "./actions";

export function DeleteProductButton({ productId }: { productId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      onClick={() => {
        if (!confirm("Är du säker på att du vill ta bort denna produkt?")) return;
        startTransition(async () => { await deleteProduct(productId); });
      }}
      disabled={isPending}
      className="shrink-0 rounded-lg p-2 text-[var(--usha-muted)] transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
    >
      <Trash2 size={14} />
    </button>
  );
}
