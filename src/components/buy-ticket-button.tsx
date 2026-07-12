"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Ticket } from "lucide-react";
import { useToast } from "@/components/ui/toaster";

interface BuyTicketButtonProps {
  listingId: string;
  originalPrice: number;
  discountedPrice: number;
  isLoggedIn: boolean;
  hasConnect: boolean;
  /** Event has ticket types (price tiers) — send the buyer to the event page to pick one. */
  hasTicketTypes?: boolean;
  eventSlug?: string | null;
}

export function BuyTicketButton({
  listingId,
  originalPrice,
  discountedPrice,
  isLoggedIn,
  hasConnect,
  hasTicketTypes = false,
  eventSlug,
}: BuyTicketButtonProps) {
  const t = useTranslations("creatorProfile");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Typed events: tier selection lives on the full event page.
  if (hasTicketTypes && eventSlug) {
    return (
      <a
        href={`/event/${eventSlug}`}
        className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-4 py-2 text-xs font-bold text-black transition hover:opacity-90"
      >
        <Ticket size={13} />
        {t("buyTicket.chooseTicket")}
      </a>
    );
  }

  if (!isLoggedIn) {
    return (
      <a
        href="/login"
        className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-4 py-2 text-xs font-bold text-black transition hover:opacity-90"
      >
        <Ticket size={13} />
        {t("buyTicket.loginToBuy")}
      </a>
    );
  }

  if (!hasConnect) {
    return (
      <span className="rounded-lg border border-[var(--usha-border)] px-4 py-2 text-xs text-[var(--usha-muted)]">
        {t("buyTicket.unavailable")}
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
        toast.error(data.error || t("buyTicket.errorSomethingWrong"));
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      toast.error(t("buyTicket.errorCouldNotStartPurchase"));
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
      {loading ? t("buyTicket.loading") : (
        <>
          {t("buyTicket.buy")}
          {hasDiscount ? (
            <span className="ml-1">
              <span className="line-through opacity-60">{originalPrice}</span>
              {" "}
              {t("buyTicket.discountedPriceSek", { discounted: discountedPrice })}
            </span>
          ) : (
            <span className="ml-1">{t("buyTicket.priceSek", { price: originalPrice })}</span>
          )}
        </>
      )}
    </button>
  );
}
