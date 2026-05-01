"use client";

import { useTransition } from "react";
import { acceptApplication, declineApplication } from "../actions";
import { useToast } from "@/components/ui/toaster";
import { Check, X } from "lucide-react";

export function GigApplicationActions({ applicationId }: { applicationId: string }) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  function handleAccept() {
    if (!confirm("Acceptera denna ansökan? Andra ansökningar avböjs och en bokning skapas.")) return;
    startTransition(async () => {
      const result = await acceptApplication(applicationId);
      if ("error" in result) {
        toast.error("Kunde inte acceptera", result.error);
      } else {
        toast.success("Ansökan accepterad", "En bokning har skapats. Slutför betalningen i bokningar.");
      }
    });
  }

  function handleDecline() {
    if (!confirm("Avböj denna ansökan?")) return;
    startTransition(async () => {
      const result = await declineApplication(applicationId);
      if ("error" in result) {
        toast.error("Kunde inte avböja", result.error);
      } else {
        toast.success("Ansökan avböjd");
      }
    });
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={handleAccept}
        disabled={isPending}
        className="flex items-center gap-1 rounded-lg bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-400 hover:bg-green-500/20 disabled:opacity-50"
      >
        <Check size={12} />
        Acceptera
      </button>
      <button
        type="button"
        onClick={handleDecline}
        disabled={isPending}
        className="flex items-center gap-1 rounded-lg border border-[var(--usha-border)] px-3 py-1.5 text-xs font-medium text-[var(--usha-muted)] hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
      >
        <X size={12} />
        Avböj
      </button>
    </div>
  );
}
