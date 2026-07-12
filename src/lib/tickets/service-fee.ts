// ---------------------------------------------------------------------------
// Ticketing service fee ("Tickster"-style) — Usha's per-ticket fee on PAID
// tickets, positioned below Tickster (~20 kr/ticket). 3% of the ticket price,
// min 3 kr, capped at 15 kr, per ticket.
//
// The organizer picks the mode per event (listings.service_fee_mode):
//   • "buyer"  → the fee is added on top; the buyer pays ticket + fee.
//   • "absorb" → the buyer pays the ticket price only; the fee is deducted from
//                the organizer's payout.
// In BOTH cases the fee amount is added to the Stripe application_fee so it stays
// with Usha (never transferred to the organizer's connected account).
//
// GATED OFF by default: nothing is charged until NEXT_PUBLIC_TICKET_SERVICE_FEE_
// ENABLED=true. Keep it off until the VAT/consumer-law treatment of the service
// fee is confirmed (§9 legal), then flip it on — like the discounts flag.
// ---------------------------------------------------------------------------

export const TICKET_SERVICE_FEE = {
  rate: 0.03, // 3%
  minOre: 300, // 3 kr floor
  capOre: 1500, // 15 kr ceiling
} as const;

export type ServiceFeeMode = "buyer" | "absorb";

export function ticketServiceFeeEnabled(): boolean {
  return process.env.NEXT_PUBLIC_TICKET_SERVICE_FEE_ENABLED === "true";
}

/**
 * The per-order service fee in öre for a paid ticket order. Returns 0 when the
 * feature is disabled or the ticket is free. `qty` supports multi-ticket orders
 * (the fee is charged per ticket).
 */
export function computeServiceFeeOre(unitPriceOre: number, qty: number = 1): number {
  if (!ticketServiceFeeEnabled()) return 0;
  if (!unitPriceOre || unitPriceOre <= 0) return 0;
  const perTicket = Math.min(
    Math.max(Math.round(unitPriceOre * TICKET_SERVICE_FEE.rate), TICKET_SERVICE_FEE.minOre),
    TICKET_SERVICE_FEE.capOre,
  );
  return perTicket * Math.max(1, qty);
}

/** Normalize a listing's stored mode to a valid ServiceFeeMode ("buyer" default). */
export function serviceFeeMode(raw: unknown): ServiceFeeMode {
  return raw === "absorb" ? "absorb" : "buyer";
}
