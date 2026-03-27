"use client";

import { useState } from "react";
import { Ticket } from "lucide-react";
import { useToast } from "@/components/ui/toaster";

interface BuyTicketButtonProps {
  listingId: string;
  originalPrice: number;
  discountedPrice: number;
  isLoggedIn: boolean;
  hasConnect: boolean;
}

export function BuyTicketButton({
  listingId,
  originalPrice,
  discountedPrice,
  isLoggedIn,
  hasConnect,
}: BuyTicketButtonProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  if (!isLoggedIn) {
    return (
      <a
        href="/login"
        className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-4 py-2 text-xs font-bold text-black transition hover:opacity-90"
      >
        <Ticket size={13} />
        Logga in för att köpa
      </a>
    );
  }

  if (!hasConnect) {
    return (
      <span className="rounded-lg border border-[var(--usha-border)] px-4 py-2 text-xs text-[var(--usha-muted)]">
        Biljettköp ej tillgängligt
      </span>
    );
  }

  const hasDiscount = discountedPrice < originalPrice;

  async function handleBuy() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/ticket-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Något gick fel");
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      toast.error("Kunde inte starta köp");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleBuy}
      disabled={loading}
      className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-4 py-2 text-xs font-bold text-black transition hover:opacity-90 disabled:opacity-50"
    >
      <Ticket size={13} />
      {loading ? "Laddar..." : (
        <>
          Köp biljett
          {hasDiscount ? (
            <span className="ml-1">
              <span className="line-through opacity-60">{originalPrice}</span>
              {" "}
              {discountedPrice} SEK
            </span>
          ) : (
            <span className="ml-1">{originalPrice} SEK</span>
          )}
        </>
      )}
    </button>
  );
}
