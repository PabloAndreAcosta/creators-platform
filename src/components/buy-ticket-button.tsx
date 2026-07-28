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

  // The event page hosts the tier picker AND guest checkout, and resolves a raw
  // listing id as well as a slug — so it's a safe target even without a slug.
  const eventHref = `/event/${eventSlug || listingId}`;

  // Typed events: tier selection lives on the full event page.
  if (hasTicketTypes) {
    return (
      <a
        href={eventHref}
        className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-4 py-2 text-xs font-bold text-black transition hover:opacity-90"
      >
        <Ticket size={13} />
        {t("buyTicket.chooseTicket")}
      </a>
    );
  }

  // Logged-out: no login wall. Send them to the event page's guest checkout —
  // they buy with just an email, no account required.
  if (!isLoggedIn) {
    return (
      <a
        href={eventHref}
        className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-4 py-2 text-xs font-bold text-black transition hover:opacity-90"
      >
        <Ticket size={13} />
        {t("buyTicket.buy")}
        <span className="ml-1">{t("buyTicket.priceSek", { price: originalPrice })}</span>
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
