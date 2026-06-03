"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toaster";
import { joinOpenEvent, leaveOpenEvent } from "./actions";

export function JoinEventButton({
  listingId,
  initialJoined,
}: {
  listingId: string;
  initialJoined: boolean;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [joined, setJoined] = useState(initialJoined);
  const [isPending, startTransition] = useTransition();

  function handleJoin() {
    startTransition(async () => {
      const result = await joinOpenEvent(listingId);
      if (result?.error) {
        toast.error("Kunde inte gå med", result.error);
        return;
      }
      setJoined(true);
      toast.success("Du är med!", "Deltagare kan nu köpa minuter av dig på eventet.");
      router.refresh();
    });
  }

  function handleLeave() {
    if (!confirm("Lämna eventet? Redan sålda minuter gäller fortfarande och kan lösas in.")) return;
    startTransition(async () => {
      const result = await leaveOpenEvent(listingId);
      if (result?.error) {
        toast.error("Kunde inte lämna", result.error);
        return;
      }
      setJoined(false);
      toast.success("Du har lämnat eventet", "Inga nya köp kan göras.");
      router.refresh();
    });
  }

  if (joined) {
    return (
      <button
        onClick={handleLeave}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm font-medium text-green-400 transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
      >
        {isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
        Du är med · Lämna
      </button>
    );
  }

  return (
    <button
      onClick={handleJoin}
      disabled={isPending}
      className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-3 py-2 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
    >
      {isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
      Erbjud mina tjänster
    </button>
  );
}
