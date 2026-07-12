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

const MAX_NAME_LEN = 60;

/** Trim + clip an attendee name; empty/blank → null. */
export function sanitizeAttendeeName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().slice(0, MAX_NAME_LEN);
  return t.length ? t : null;
}

/**
 * Serialize up to `qty` attendee names into a single Stripe metadata value
 * (500-char cap). Returns "" when there are no names, or if the JSON would
 * overflow (10 short first names fit comfortably; the guard is a safety net so
 * checkout never fails — names just fall back to "Gäst i" on the ticket).
 */
export function attendeeNamesToMeta(names: unknown, qty: number): string {
  if (!Array.isArray(names)) return "";
  const clipped = names.slice(0, qty).map((n) => sanitizeAttendeeName(n) ?? "");
  if (clipped.every((n) => n === "")) return "";
  const json = JSON.stringify(clipped);
  return json.length <= 450 ? json : "";
}

/** Parse the attendee-names metadata value back to an array (safe; [] on error). */
export function attendeeNamesFromMeta(raw: string | undefined | null): (string | null)[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map(sanitizeAttendeeName) : [];
  } catch {
    return [];
  }
}

/**
 * Create N attendee rows (idx 1..N) for a multi-ticket booking, optionally named
 * (names[i] → row idx i+1). No-op for count <= 1 (single tickets never get
 * attendee rows). Must be called with a service-role client (ticket_attendees
 * has no insert RLS policy).
 */
export async function createTicketAttendees(
  client: SupabaseClient,
  bookingId: string,
  count: number,
  names?: unknown[]
): Promise<void> {
  if (count <= 1) return;
  const rows = Array.from({ length: count }, (_, i) => ({
    booking_id: bookingId,
    idx: i + 1,
    name: sanitizeAttendeeName(names?.[i]),
  }));
  const { error } = await client.from("ticket_attendees").insert(rows);
  if (error) console.error("createTicketAttendees failed:", error);
}
