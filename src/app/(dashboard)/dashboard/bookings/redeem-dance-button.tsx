"use client";

import { useTransition } from "react";
import { redeemDance } from "./actions";
import { useToast } from "@/components/ui/toaster";
import { Music, Check } from "lucide-react";

export function RedeemDanceButton({
  bookingId,
  redeemed,
  total,
}: {
  bookingId: string;
  redeemed: number;
  total: number;
}) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const allDone = redeemed >= total;

  function handle() {
    if (allDone) return;
    startTransition(async () => {
      const result = await redeemDance(bookingId);
      if ("error" in result) {
        toast.error("Kunde inte inlösa", result.error);
        return;
      }
      if (result.reachedTotal) {
        toast.success("Alla danser inlösta", "Bokningen är slutförd.");
      } else {
        toast.success(`Dans ${result.redeemed} av ${result.total} inlöst`);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={isPending || allDone}
      className="flex items-center gap-1 rounded-lg bg-[var(--usha-gold)]/10 px-3 py-1.5 text-xs font-medium text-[var(--usha-gold)] hover:bg-[var(--usha-gold)]/20 disabled:opacity-50"
    >
      {allDone ? <Check size={12} /> : <Music size={12} />}
      {allDone ? `Alla ${total} inlösta` : `Inlös dans (${redeemed}/${total})`}
    </button>
  );
}

export function DanceCounter({ redeemed, total }: { redeemed: number; total: number }) {
  return (
    <span className="flex items-center gap-1 rounded-full bg-[var(--usha-gold)]/10 px-2 py-0.5 text-xs font-medium text-[var(--usha-gold)]">
      <Music size={10} />
      {redeemed}/{total} danser
    </span>
  );
}
