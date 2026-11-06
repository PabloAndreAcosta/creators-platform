import { stripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Hittar bokningen bakom en Stripe Checkout-session.
 *
 * Gästen landar på /biljett/klar med session_id i adressen innan webhooken
 * hunnit skriva bokningen — ibland sekunder efter, ibland samtidigt. Den här
 * hjälparen används både av sidan (första försöket) och av /api/tickets/by-session
 * (poll tills bokningen finns), så att gästen får sin biljett på skärmen
 * utan att gå in i mejlen.
 *
 * Sessions-id:t är hemligt på samma sätt som bokningslänken: det syns bara för
 * den som genomförde köpet. Nyckeln är betalningens id (stripe_payment_id),
 * samma som webhooken skriver.
 */
export const CHECKOUT_SESSION_RE = /^cs_[A-Za-z0-9_]+$/;

export interface SessionBooking {
  id: string;
  amount_paid: number | null;
  guest_count: number | null;
  listing_id: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  listing: { title: string | null; listing_type: string | null } | null;
}

export async function findBookingForSession(sessionId: string): Promise<SessionBooking | null> {
  if (!CHECKOUT_SESSION_RE.test(sessionId)) return null;
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const paymentIntent = typeof session.payment_intent === "string" ? session.payment_intent : null;
  if (!paymentIntent) return null;
  const { data: booking } = await createAdminClient()
    .from("bookings")
    .select("id, amount_paid, guest_count, listing_id, utm_source, utm_medium, utm_campaign, listings(title, listing_type)")
    .eq("stripe_payment_id", paymentIntent)
    .maybeSingle();
  if (!booking) return null;
  const listing = Array.isArray(booking.listings) ? booking.listings[0] : booking.listings;
  return {
    id: booking.id,
    amount_paid: booking.amount_paid,
    guest_count: booking.guest_count,
    listing_id: booking.listing_id,
    utm_source: booking.utm_source,
    utm_medium: booking.utm_medium,
    utm_campaign: booking.utm_campaign,
    listing: listing ? { title: listing.title, listing_type: listing.listing_type } : null,
  };
}
