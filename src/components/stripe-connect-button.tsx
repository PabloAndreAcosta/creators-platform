"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toaster";

export function StripeConnectButton({
  label = "Koppla Stripe",
  className,
}: {
  label?: string;
  className?: string;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    try {
      const res = await fetch("/api/stripe/connect", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      toast.error(data.error ?? "Kunde inte starta Stripe-koppling");
    } catch {
      toast.error("Nätverksfel");
    }
    setBusy(false);
  }

  return (
    <button
      onClick={go}
      disabled={busy}
      className={
        className ??
        "inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-4 py-2 text-sm font-bold text-black transition hover:opacity-90 disabled:opacity-60"
      }
    >
      {busy ? <Loader2 size={15} className="animate-spin" /> : null}
      {label}
    </button>
  );
}
