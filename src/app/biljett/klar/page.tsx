import { TrackPurchase } from "@/components/track-purchase";
import type { PurchasePayload } from "@/lib/analytics/events";
import Link from "next/link";
import { CheckCircle2, Mail } from "lucide-react";
import { CHECKOUT_SESSION_RE, findBookingForSession } from "@/lib/tickets/session-booking";
import { AwaitTicket, TicketLink } from "./await-ticket";

import { notIndexable } from "@/lib/seo/metadata";

export const metadata = { title: "Tack för ditt köp — Usha Platform", ...notIndexable() };

// Post-purchase confirmation for GUEST ticket buyers (no account). The Stripe
// success_url points here so a buyer gets a clear "it worked" screen instead of
// landing on the feed. The ticket page (/biljett/<id>) is one tap away — the
// email is a backup, not the only way in.
export default async function TicketPurchaseDonePage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;
  const sessionOk = !!session_id && CHECKOUT_SESSION_RE.test(session_id);

  // Köpet rapporteras från bokningen, inte från adressen: beloppet blir det
  // betalda och transaction_id blir bokningens id, så en omladdning inte
  // räknas som ett andra köp. Hinner webhooken inte före den här sidan blir
  // det ingen händelse alls — hellre en tappad rad än en påhittad.
  let purchase: PurchasePayload | null = null;
  let bookingId: string | null = null;
  if (sessionOk) {
    try {
      const booking = await findBookingForSession(session_id);
      if (booking) {
        bookingId = booking.id;
        purchase = {
          transaction_id: booking.id,
          value: (booking.amount_paid ?? 0) / 100,
          currency: "SEK",
          items: [
            {
              item_id: booking.listing_id ?? booking.id,
              item_name: booking.listing?.title ?? "Biljett",
              item_category: booking.listing?.listing_type === "package" ? "pass" : "ticket",
              price: (booking.amount_paid ?? 0) / 100,
              quantity: booking.guest_count ?? 1,
            },
          ],
          ...(booking.utm_source ? { utm_source: booking.utm_source } : {}),
          ...(booking.utm_medium ? { utm_medium: booking.utm_medium } : {}),
          ...(booking.utm_campaign ? { utm_campaign: booking.utm_campaign } : {}),
        };
      }
    } catch {
      // Ett tappat mätvärde är inte värt en trasig kvittosida.
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      {purchase && <TrackPurchase payload={purchase} />}
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--usha-gold)]/15">
        <CheckCircle2 size={36} className="text-[var(--usha-gold)]" />
      </div>
      <h1 className="mb-2 text-2xl font-bold text-[var(--usha-white)]">Tack för ditt köp! 🎉</h1>
      <p className="mb-6 max-w-md text-sm text-[var(--usha-muted)]">
        Din biljett är bekräftad. Visa QR-koden vid entrén — direkt här eller från mejlet.
      </p>
      {bookingId ? <TicketLink bookingId={bookingId} /> : sessionOk ? <AwaitTicket sessionId={session_id} /> : null}
      <div className="mb-8 flex items-center gap-2 rounded-lg border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm text-[var(--usha-white)]">
        <Mail size={16} className="text-[var(--usha-gold)]" />
        Vi har också mejlat biljetten (kolla skräpposten om den dröjer).
      </div>
      <Link
        href="/"
        className="rounded-lg border border-[var(--usha-border)] px-5 py-2.5 text-sm font-medium text-[var(--usha-muted)] transition-colors hover:text-[var(--usha-white)]"
      >
        Till startsidan
      </Link>
    </div>
  );
}
