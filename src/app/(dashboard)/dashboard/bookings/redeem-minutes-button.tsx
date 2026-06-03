"use client";

import { useTransition } from "react";
import { redeemMinutes } from "./actions";
import { useToast } from "@/components/ui/toaster";
import { Clock, Check } from "lucide-react";

const STEP = 15;

export function RedeemMinutesButton({
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
      const result = await redeemMinutes(bookingId, STEP);
      if ("error" in result) {
        toast.error("Kunde inte lösa in", result.error);
        return;
      }
      if (result.reachedTotal) {
        toast.success("Alla minuter inlösta", `${result.total} min klart.`);
      } else {
        toast.success(`${result.redeemed} / ${result.total} min inlösta`);
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
      {allDone ? <Check size={12} /> : <Clock size={12} />}
      {allDone ? `${total} min inlösta` : `Lös in ${STEP} min (${redeemed}/${total})`}
    </button>
  );
}

export function MinutesCounter({ redeemed, total }: { redeemed: number; total: number }) {
  return (
    <span className="flex items-center gap-1 rounded-full bg-[var(--usha-gold)]/10 px-2 py-0.5 text-xs font-medium text-[var(--usha-gold)]">
      <Clock size={10} />
      {redeemed}/{total} min
    </span>
  );
}
