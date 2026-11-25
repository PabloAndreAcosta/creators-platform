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
 * för kvällen, för biljettypen när en sådan är vald och för varje biljettpool
 * biljettypen ingår i. Det minsta av
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
  /** Biljettpooler som biljettypen ingår i: kapacitet, sålda i poolen och poolens biljettyper. */
  pools?: SeatPool[];
  /** Vilande Swish-bokningar på kvällen. */
  pending: SeatPending[];
  quantity: number;
  /** Efter insert: räkna bara de vilande som kom före den här bokningen. */
  ownBookingId?: string | null;
}

export interface SeatPool {
  capacity: number | null;
  sold: number;
  ticketTypeIds: string[];
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
  for (const pool of input.pools ?? []) {
    if (pool.capacity == null) continue;
    const held = counted
      .filter((b) => b.ticket_type_id != null && pool.ticketTypeIds.includes(b.ticket_type_id))
      .reduce((s, b) => s + seats(b), 0);
    limits.push(pool.capacity - pool.sold - held);
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

/**
 * Färska siffror för kvällen, biljettypen och dess pooler. Läses om vid varje
 * kontroll, så att omkontrollen efter insert ser kortköp som hunnit reservera
 * under tiden (reserve_ticket räknar i sin tur med de vilande Swish-köpen).
 */
export async function loadSeatCounts(
  admin: SupabaseClient,
  listingId: string,
  ticketTypeId: string | null,
): Promise<Pick<SeatInput, "listing" | "ticketType" | "pools">> {
  const { data: listing, error } = await admin
    .from("listings")
    .select("capacity, tickets_sold")
    .eq("id", listingId)
    .single();
  if (error || !listing) throw error ?? new Error("listing missing");
  if (!ticketTypeId) return { listing, ticketType: null, pools: [] };

  const { data: tt, error: ttError } = await admin
    .from("ticket_types")
    .select("id, capacity, tickets_sold")
    .eq("id", ticketTypeId)
    .single();
  if (ttError || !tt) throw ttError ?? new Error("ticket type missing");

  const { data: links, error: linkError } = await admin
    .from("ticket_type_pools")
    .select("pool_id")
    .eq("ticket_type_id", ticketTypeId);
  if (linkError) throw linkError;
  const poolIds = (links ?? []).map((l: { pool_id: string }) => l.pool_id);
  if (poolIds.length === 0) return { listing, ticketType: tt, pools: [] };

  const [{ data: poolRows, error: poolError }, { data: members, error: memberError }] = await Promise.all([
    admin.from("ticket_pools").select("id, capacity").in("id", poolIds),
    admin.from("ticket_type_pools").select("pool_id, ticket_type_id").in("pool_id", poolIds),
  ]);
  if (poolError) throw poolError;
  if (memberError) throw memberError;
  const memberRows = (members ?? []) as { pool_id: string; ticket_type_id: string }[];
  const typeIds = [...new Set(memberRows.map((m) => m.ticket_type_id))];
  const { data: types, error: typesError } = await admin
    .from("ticket_types")
    .select("id, tickets_sold")
    .in("id", typeIds);
  if (typesError) throw typesError;
  const soldBy = new Map(((types ?? []) as { id: string; tickets_sold: number | null }[]).map((t) => [t.id, t.tickets_sold ?? 0]));

  const pools: SeatPool[] = ((poolRows ?? []) as { id: string; capacity: number | null }[]).map((p) => {
    const ids = memberRows.filter((m) => m.pool_id === p.id).map((m) => m.ticket_type_id);
    return { capacity: p.capacity, sold: ids.reduce((s, id) => s + (soldBy.get(id) ?? 0), 0), ticketTypeIds: ids };
  });
  return { listing, ticketType: tt, pools };
}
