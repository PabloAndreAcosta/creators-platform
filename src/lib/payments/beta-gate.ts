/**
 * Beta payment gate.
 *
 * During the free beta, real (destination-charge) payments to a creator/venue
 * are restricted to the platform owner and VERIFIED COMPANIES. This limits the
 * legal/tax exposure of routing money to private individuals before the payment
 * model is legally confirmed (see Usha_byggspec_onboarding.md §9). Everyone else
 * can use the app for free — bookings/events still work, just without in-app
 * online payment.
 *
 * Lift the restriction (open payments to all eligible Connect sellers) by setting
 * NEXT_PUBLIC_PAYMENTS_OPEN=true once beta ends.
 */

const OWNER_PAYEE_IDS = (
  process.env.PAYMENT_OWNER_IDS ?? "15d852ed-1f33-446f-9bcb-821c2444c84f" // pablo.acosta@usha.se
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export function paymentsOpenToAll(): boolean {
  return process.env.NEXT_PUBLIC_PAYMENTS_OPEN === "true";
}

export interface PayeeEligibility {
  id: string;
  company_verified_at: string | null;
}

/** True if this payee may receive real payments right now. */
export function canReceivePayments(payee: PayeeEligibility | null | undefined): boolean {
  if (!payee) return false;
  if (paymentsOpenToAll()) return true; // beta over → open to all Connect sellers
  if (OWNER_PAYEE_IDS.includes(payee.id)) return true; // platform owner (testing)
  return !!payee.company_verified_at; // verified real company
}

export const PAYMENTS_BETA_BLOCKED_MESSAGE =
  "Onlinebetalning är inte aktiverad för den här arrangören under beta. Bokningen fungerar ändå – betalning sker direkt med arrangören.";
