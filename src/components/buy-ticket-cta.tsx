"use client";

import { useRouter } from "next/navigation";
import { Ticket } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Compact "buy ticket / book" CTA for event cards in browse/discovery views
 * (home, search, experiences, calendar). Navigates to the listing detail page
 * where the full, canonical purchase flow lives (gate, discount, free handling).
 *
 * A <button> (not <a>) so it can live inside cards that are themselves links
 * without nesting anchors; stopPropagation avoids double navigation.
 */
export function BuyTicketCta({
  listingId,
  slug,
  price,
  className,
}: {
  listingId: string;
  slug?: string | null;
  price?: number | null;
  className?: string;
}) {
  const router = useRouter();
  const t = useTranslations("eventPage");
  const isFree = !price || price <= 0;
  const href = `/listing/${slug || listingId}`;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        router.push(href);
      }}
      className={
        className ??
        "inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-3 py-2 text-xs font-semibold text-black transition hover:opacity-90"
      }
    >
      <Ticket size={13} />
      {isFree ? t("freeTicket") : t("buyTicket", { price: price! })}
    </button>
  );
}
