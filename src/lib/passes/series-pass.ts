import type { SupabaseClient } from "@supabase/supabase-js";
import { isEventDay, stockholmDay } from "@/lib/tickets/event-day";
import type { SettlementBookingRow } from "@/lib/settlements/aggregate";

/**
 * Klippkort på en serie.
 *
 * En bokning är ett klippkort när sessions_total > 0. Är kortets annons
 * (listing) kopplad till en serie via pass_series_id fungerar QR-koden som
 * biljett på seriens kvällar: ett klipp per kväll, loggat i pass_redemptions.
 */
export interface PassBookingLike {
  sessions_total: number | null;
  sessions_redeemed: number | null;
}

export function isPassBooking(b: PassBookingLike): boolean {
  return (b.sessions_total ?? 0) > 0;
}

export function passRemaining(b: PassBookingLike): number {
  return Math.max(0, (b.sessions_total ?? 0) - (b.sessions_redeemed ?? 0));
}

/** Kolumnerna en bokning får när kassan sålde ett klippkort. */
export function passBookingFields(sessionsTotal: string | number | null | undefined) {
  const n = Number(sessionsTotal);
  return Number.isFinite(n) && n > 0 ? { sessions_total: n, sessions_redeemed: 0 } : {};
}

export interface PassMoney {
  amount_paid: number | null;
  platform_fee_amount: number | null;
  credit_applied_ore?: number | null;
  sessions_total: number | null;
}

/**
 * Den del av kortets pris som hör till ETT tillfälle. Kvällens avräkning ska
 * se ett klipp som en biljett värd 1/N av kortet — inte hela kortet den kväll
 * det köptes, och inte noll de kvällar det används.
 */
export function redemptionSlice(b: PassMoney) {
  const n = Math.max(1, b.sessions_total ?? 1);
  return {
    amount_paid: Math.round((b.amount_paid ?? 0) / n),
    platform_fee_amount: b.platform_fee_amount == null ? null : Math.round(b.platform_fee_amount / n),
    credit_applied_ore: Math.round((b.credit_applied_ore ?? 0) / n),
  };
}

export interface Occurrence {
  id: string;
  title: string;
  event_date: string;
  event_time: string | null;
  event_location: string | null;
}

/** Kvällens tillfälle (Stockholmstid, med nattmarginal) och nästa kommande. */
export function pickOccurrence(
  occurrences: readonly Occurrence[],
  now: Date = new Date()
): { today: Occurrence | null; next: Occurrence | null } {
  const sorted = [...occurrences].sort((a, b) => a.event_date.localeCompare(b.event_date));
  const today = sorted.find((o) => isEventDay(o.event_date, now)) ?? null;
  const day = stockholmDay(now);
  const next = sorted.find((o) => o.event_date > day && o.id !== today?.id) ?? null;
  return { today, next };
}

export async function seriesOccurrences(admin: SupabaseClient, seriesId: string): Promise<Occurrence[]> {
  const { data } = await admin
    .from("listings")
    .select("id, title, event_date, event_time, event_location")
    .eq("series_id", seriesId)
    .eq("is_active", true)
    .not("event_date", "is", null)
    .order("event_date", { ascending: true });
  return (data as Occurrence[] | null) ?? [];
}

/**
 * Avräkningsrader för ett tillfälle: varje inlöst klipp räknas som en biljett
 * värd 1/N av kortet. Återbetalda kort räknas inte alls — pengarna gick
 * tillbaka, och en delad återbetalning över flera kvällar är inte byggd.
 */
export async function passRedemptionRows(
  admin: SupabaseClient,
  occurrenceId: string
): Promise<SettlementBookingRow[]> {
  const { data } = await admin
    .from("pass_redemptions")
    .select("booking:bookings!booking_id(status, amount_paid, platform_fee_amount, credit_applied_ore, sessions_total)")
    .eq("listing_id", occurrenceId);

  const rows: SettlementBookingRow[] = [];
  for (const r of (data ?? []) as unknown as { booking: (PassMoney & { status: string | null }) | (PassMoney & { status: string | null })[] | null }[]) {
    const b = Array.isArray(r.booking) ? r.booking[0] : r.booking;
    if (!b || b.status === "canceled") continue;
    rows.push({ status: "completed", guest_count: 1, refund_amount: null, ...redemptionSlice(b) });
  }
  return rows;
}
