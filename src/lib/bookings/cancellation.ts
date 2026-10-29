import { stockholmLocalToUtcISO } from "@/lib/time";

/**
 * Avbokningstid: varje kreatör och venue bestämmer själv hur sent en kund får
 * avboka (profiles.cancellation_hours). NULL = ingen gräns. Efter gränsen kan
 * bara säljaren avboka — och då återbetalas allt som förut. Gränsen styr alltså
 * vem som får avboka, inte hur mycket som betalas tillbaka.
 */
export const CANCELLATION_HOUR_OPTIONS = [2, 6, 12, 24, 48, 72, 168] as const;

export function parseCancellationHours(value: unknown): number | null {
  const n = Number(value);
  return (CANCELLATION_HOUR_OPTIONS as readonly number[]).includes(n) ? n : null;
}

/**
 * När bokningen börjar. Ett evenemang börjar när kvällen börjar (inte när
 * biljetten köptes); en tjänst vid den bokade tiden. Ett klippkort har ingen
 * egen tidpunkt.
 */
export function bookingStartsAt(input: {
  scheduledAt: string | null;
  listingType: string | null;
  eventDate: string | null;
  eventTime: string | null;
}): Date | null {
  if (input.eventDate) {
    const iso = stockholmLocalToUtcISO(`${input.eventDate.slice(0, 10)}T${(input.eventTime ?? "00:00").slice(0, 5)}`);
    return iso ? new Date(iso) : null;
  }
  if (input.listingType === "package" || !input.scheduledAt) return null;
  return new Date(input.scheduledAt);
}

export function cancellationDeadline(startsAt: Date | null, hours: number | null): Date | null {
  if (!startsAt || hours == null) return null;
  return new Date(startsAt.getTime() - hours * 3600_000);
}

export type CustomerCancelBlock = "deadlinePassed" | "packageInUse" | null;

/** Får kunden avboka själv just nu? Säljaren får alltid. */
export function customerCancelBlock(input: {
  now: Date;
  deadline: Date | null;
  sessionsRedeemed: number | null;
  minutesRedeemed: number | null;
}): CustomerCancelBlock {
  // Ett påbörjat klippkort eller minutpaket kan inte lämnas tillbaka i sin
  // helhet av köparen — då vore de använda gångerna gratis.
  if ((input.sessionsRedeemed ?? 0) > 0 || (input.minutesRedeemed ?? 0) > 0) return "packageInUse";
  if (input.deadline && input.now.getTime() > input.deadline.getTime()) return "deadlinePassed";
  return null;
}
