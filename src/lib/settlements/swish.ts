import type { SupabaseClient } from "@supabase/supabase-js";
import { aggregateEventBookings } from "./aggregate";
import { splitEventRevenue } from "./split";

/**
 * Swish-försäljningen i avräkningen.
 *
 * Swish-betalningar i dörren landar på Usha AB:s bankkonto, inte hos Stripe.
 * De kan därför inte föras över automatiskt (run-payouts filtrerar bort dem),
 * men partnern har samma andel av dem som av kortbetalningarna. Här summeras
 * de för sig, så att både kvällens avräkningssida och månadsunderlaget kan
 * visa: så här mycket såldes via Swish, och så här mycket av det är er
 * andel — den betalas via bank.
 */
export interface SwishTotals {
  tickets: number;
  grossOre: number;
  refundedOre: number;
}

export const EMPTY_SWISH: SwishTotals = { tickets: 0, grossOre: 0, refundedOre: 0 };

export async function swishTotalsByListing(
  db: SupabaseClient,
  listingIds: readonly string[]
): Promise<Map<string, SwishTotals>> {
  const out = new Map<string, SwishTotals>();
  if (listingIds.length === 0) return out;
  const { data } = await db
    .from("bookings")
    .select("listing_id, status, amount_paid, platform_fee_amount, refund_amount, guest_count, credit_applied_ore")
    .in("listing_id", [...listingIds])
    .eq("booking_type", "ticket")
    .eq("payment_method", "swish");
  const byListing = new Map<string, NonNullable<typeof data>>();
  for (const b of data ?? []) {
    const id = b.listing_id as string;
    if (!byListing.has(id)) byListing.set(id, []);
    byListing.get(id)!.push(b);
  }
  for (const [id, rows] of byListing) {
    const t = aggregateEventBookings(rows, 0);
    out.set(id, { tickets: t.ticketsSold, grossOre: t.grossOre, refundedOre: t.refundedOre });
  }
  return out;
}

/** Partnerns andel av Swish-försäljningen, räknad exakt som kortdelen. */
export function swishPartnerShareOre(totals: SwishTotals, vatRate: number, partnerPercent: number): number {
  if (totals.grossOre - totals.refundedOre <= 0) return 0;
  return splitEventRevenue({ grossOre: totals.grossOre, refundedOre: totals.refundedOre, vatRate, partnerPercent }).partnerOre;
}
