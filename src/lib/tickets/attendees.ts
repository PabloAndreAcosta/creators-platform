// Helpers for per-attendee tickets. A multi-ticket order (guest_count = N > 1)
// gets N ticket_attendees rows; single-ticket orders get none and keep the
// booking-level QR/check-in path unchanged.

import type { SupabaseClient } from "@supabase/supabase-js";

/** Clamp a requested ticket quantity to a sane range (1..MAX_TICKETS_PER_ORDER). */
export const MAX_TICKETS_PER_ORDER = 10;
export function clampQuantity(raw: unknown): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_TICKETS_PER_ORDER);
}

/**
 * Create N attendee rows (idx 1..N) for a multi-ticket booking. No-op for
 * count <= 1 (single tickets never get attendee rows). Must be called with a
 * service-role client (ticket_attendees has no insert RLS policy).
 */
export async function createTicketAttendees(
  client: SupabaseClient,
  bookingId: string,
  count: number
): Promise<void> {
  if (count <= 1) return;
  const rows = Array.from({ length: count }, (_, i) => ({ booking_id: bookingId, idx: i + 1 }));
  const { error } = await client.from("ticket_attendees").insert(rows);
  if (error) console.error("createTicketAttendees failed:", error);
}
