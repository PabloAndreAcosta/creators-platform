import { getSaleState, type SaleInput } from "@/lib/listings/sale-state";

/**
 * Får en Swish-betalning från eventsidan läggas för den här kvällen just nu?
 *
 * Samma gräns som kortkassan (sale-state, lib/tickets/evening.ts): vanliga
 * köp bara till en kommande eller pågående kväll, aldrig till en passerad,
 * inte före släppet och inte när det är slutsålt. Priset är det kortkassan
 * tar, förköpspriset inräknat, så att beloppet i Swish stämmer med knappen.
 *
 * "Var du där?" (efterköp) erbjuds INTE med Swish. Swish Företag har inget
 * API: betalningen bekräftas för hand i entrén, och spärren mot dubbelköp,
 * kvällens datum på kvittot och 24-timmarsfönstret finns bara i kortkassan.
 * En passerad kväll nekas här, oavsett vad klienten skickar.
 */
export type SwishIntentGate =
  | { ok: true; price: number }
  | { ok: false; status: 403; code: "past" | "notReleased" | "soldOut" };

export function swishIntentGate(listing: SaleInput, now: Date): SwishIntentGate {
  const sale = getSaleState(listing, now);
  if (sale.buyable) return { ok: true, price: sale.price };
  const code = sale.state === "past" ? "past" : sale.state === "before" ? "notReleased" : "soldOut";
  return { ok: false, status: 403, code };
}
