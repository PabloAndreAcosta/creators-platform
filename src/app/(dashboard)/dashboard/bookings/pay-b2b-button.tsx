"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/toaster";
import { CreditCard, Loader2 } from "lucide-react";

export function PayB2BButton({ bookingId, price }: { bookingId: string; price: number | null }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/booking-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error("Kunde inte starta betalning", data.error || "Okänt fel");
        setLoading(false);
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      toast.error("Kunde inte starta betalning", "Försök igen.");
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-3 py-2 text-xs font-bold text-black transition hover:opacity-90 disabled:opacity-50"
    >
      {loading ? <Loader2 size={12} className="animate-spin" /> : <CreditCard size={12} />}
      {loading ? "Laddar..." : price != null ? `Betala ${price} SEK` : "Betala"}
    </button>
  );
}
