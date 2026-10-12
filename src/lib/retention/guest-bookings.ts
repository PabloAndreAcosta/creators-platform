/**
 * Gallring av gästuppgifter.
 *
 * En gästbokning bär namn och mejladress på någon som aldrig skapat ett konto.
 * För bokföringen behövs beloppet och datumet — inte vem personen var. Därför
 * anonymiseras raden när den inte längre fyller någon funktion, i stället för
 * att raderas: bokföringsspåret måste vara obrutet, och en borttagen rad skulle
 * få kvällens siffror att sluta stämma.
 *
 * Fönstret räknas från KVÄLLEN, inte från köpet. Ett köp i juni till en kväll i
 * december ska inte gallras i december.
 */

/** Dagar efter evenemanget innan uppgifterna gallras. */
export const RETENTION_DAYS = 180;

export interface GuestBookingRow {
  id: string;
  guest_email: string | null;
  guest_name: string | null;
  /** Kvällens datum, "YYYY-MM-DD". null = tjänstebokning utan eventdatum. */
  event_date: string | null;
  /** Används när eventdatum saknas. */
  created_at: string;
  anonymized_at: string | null;
}

export type SkipReason =
  | "already_anonymized"
  | "nothing_to_clear"
  | "inside_window";

/**
 * Varför en rad INTE gallras, eller null när den ska gallras.
 *
 * Fönstret är 180 dagar efter kvällen. Det är satt efter reklamationsfönstret,
 * inte efter bokföringskravet: så länge en betalning kan bestridas måste vi
 * kunna svara på vem köpet gällde. Bokföringen i sig behöver bara belopp och
 * datum, och de rörs aldrig.
 */
export function skipReason(
  row: GuestBookingRow,
  now: Date = new Date(),
  retentionDays: number = RETENTION_DAYS
): SkipReason | null {
  if (row.anonymized_at) return "already_anonymized";
  if (!row.guest_email && !row.guest_name) return "nothing_to_clear";

  const basis = row.event_date ? new Date(`${row.event_date}T23:59:59Z`) : new Date(row.created_at);
  if (Number.isNaN(basis.getTime())) return "inside_window";

  const cutoff = new Date(now.getTime() - retentionDays * 86_400_000);
  if (basis > cutoff) return "inside_window";
  return null;
}

export function shouldAnonymize(
  row: GuestBookingRow,
  now: Date = new Date(),
  retentionDays: number = RETENTION_DAYS
): boolean {
  return skipReason(row, now, retentionDays) === null;
}

/**
 * Vad som skrivs över raden. Namnet blir tomt och adressen en platshållare —
 * inte null, eftersom koden på flera ställen skiljer gästbokning från
 * kontobokning på att guest_email finns.
 */
export function anonymizedPatch(now: Date = new Date()): {
  guest_email: string;
  guest_name: null;
  anonymized_at: string;
} {
  return {
    guest_email: "gallrad@usha.invalid",
    guest_name: null,
    anonymized_at: now.toISOString(),
  };
}
