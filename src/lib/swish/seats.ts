import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Räcker platserna för ett Swish-köp från eventsidan?
 *
 * Kortkassan reserverar platserna i tickets_sold redan när kassan öppnas
 * (reserve_ticket, radlåst), så ett väntande kortköp är redan räknat. Ett
 * Swish-köp räknas däremot först när entrén bekräftar det. Därför räknas här:
 *
 *   kvar = kapacitet − tickets_sold − platser i VILANDE Swish-bokningar
 *
 * både för kvällen och för biljettypen när en sådan är vald. Det minsta av
 * de två gäller. Ingen kapacitet (null) betyder ingen gräns.
 *
 * Kapplöpningen (två "Jag har swishat" samtidigt) löses utan lås: bokningen
 * läggs först, sedan räknas igen med bara de vilande Swish-bokningar som kom
 * FÖRE den egna (created_at, sedan id). Den som kom sist över gränsen
 * avbokas. Det är samma ordning åt båda hållen, så exakt en av två
 * samtidiga vinner den sista platsen.
 */

export interface SeatPending {
  id: string;
  guest_count: number | null;
  ticket_type_id: string | null;
  created_at: string;
}

export interface SeatInput {
  listing: { capacity: number | null; tickets_sold: number | null };
  ticketType?: { id: string; capacity: number | null; tickets_sold: number | null } | null;
  /** Vilande Swish-bokningar på kvällen. */
  pending: SeatPending[];
  quantity: number;
  /** Efter insert: räkna bara de vilande som kom före den här bokningen. */
  ownBookingId?: string | null;
}

export type SeatResult = { ok: true; left: number | null } | { ok: false; left: number };

function isAhead(b: SeatPending, own: SeatPending): boolean {
  if (b.id === own.id) return false;
  if (b.created_at !== own.created_at) return b.created_at < own.created_at;
  return b.id < own.id;
}

export function swishSeatsLeft(input: SeatInput): SeatResult {
  const own = input.ownBookingId ? input.pending.find((b) => b.id === input.ownBookingId) ?? null : null;
  const counted = own ? input.pending.filter((b) => isAhead(b, own)) : input.pending.filter((b) => b.id !== input.ownBookingId);
  const seats = (b: SeatPending) => Math.max(1, b.guest_count ?? 1);

  const limits: number[] = [];
  const cap = input.listing.capacity;
  if (cap != null) {
    const held = counted.reduce((s, b) => s + seats(b), 0);
    limits.push(cap - (input.listing.tickets_sold ?? 0) - held);
  }
  const tt = input.ticketType;
  if (tt && tt.capacity != null) {
    const held = counted.filter((b) => b.ticket_type_id === tt.id).reduce((s, b) => s + seats(b), 0);
    limits.push(tt.capacity - (tt.tickets_sold ?? 0) - held);
  }
  if (limits.length === 0) return { ok: true, left: null };
  const left = Math.max(0, Math.min(...limits));
  return input.quantity <= left ? { ok: true, left } : { ok: false, left };
}

/** Vilande Swish-bokningar på kvällen, för swishSeatsLeft. */
export async function pendingSwishSeats(admin: SupabaseClient, listingId: string): Promise<SeatPending[]> {
  const { data, error } = await admin
    .from("bookings")
    .select("id, guest_count, ticket_type_id, created_at")
    .eq("listing_id", listingId)
    .eq("payment_method", "swish")
    .eq("status", "pending");
  if (error) throw error;
  return (data ?? []) as SeatPending[];
}
