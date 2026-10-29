/**
 * Taxipass: regler för volontärpass som taxidansare på en kväll.
 *
 * En taxidansare är VOLONTÄR. Hen får ingen lön, bara fri entré och en
 * matkupong (burgare + alkoholfri dryck) per kväll. Passen ligger mellan
 * 17 och 23 och är minst två timmar, och dansaren väljer själv vilka pass
 * hen tar. Alkoholfritt under passet. Den som anmäler sig ska ha verifierat
 * sig med Mobilt BankID och ha fyllt 18.
 *
 * Avbokning ska ske senast kl. 10 samma dag. Sen avbokning eller uteblivet
 * pass (ingen incheckning) ger en varning. Tre varningar inom sex månader hos
 * samma arrangör (eller i samma serie, t.ex. The Lab) ger sex månaders
 * avstängning, och efter den börjar räkningen om från noll. Varningar äldre än
 * sex månader räknas inte heller. Allt räknas fram ur passen — det finns ingen
 * räknare som kan glida isär från det som faktiskt hände.
 *
 * Dansaren checkar bara in. Utcheckning behövs inte.
 *
 * Rena funktioner. Tider in som ISO, Stockholmstid räknas här.
 */

import { stockholmEventISO, stockholmToday } from "@/lib/time";
import { ageOnDate } from "@/lib/bankid/birth-date";

export const TAXI_WINDOW = { from: "17:00", to: "23:00" } as const;
export const MIN_SHIFT_MINUTES = 120;
export const STRIKE_LIMIT = 3;
/** Varningar räknas inom så här många månader, och avstängningen varar lika länge. */
export const STRIKE_WINDOW_MONTHS = 6;
export const SUSPENSION_MONTHS = 6;
/** Sista avbokning utan varning: den här tiden samma dag. */
export const CANCEL_DEADLINE_TIME = "10:00";
export const MIN_AGE = 18;
/** Incheckning öppnar så här långt innan passet. */
export const CHECKIN_EARLY_MINUTES = 30;

const MIN = 60_000;
const ms = (iso: string) => Date.parse(iso);

export type ShiftError = "time" | "window" | "length" | "capacity";

/** Kontrollerar ett pass som arrangören lägger upp. Tider som "HH:MM". */
export function validateShift(input: {
  eventDate: string;
  startTime: string;
  endTime: string;
  capacity: number;
}): { ok: true; startsAt: string; endsAt: string } | { ok: false; error: ShiftError } {
  const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!hhmm.test(input.startTime) || !hhmm.test(input.endTime)) return { ok: false, error: "time" };
  if (input.startTime < TAXI_WINDOW.from || input.endTime > TAXI_WINDOW.to) return { ok: false, error: "window" };
  if (!Number.isInteger(input.capacity) || input.capacity < 1 || input.capacity > 50) return { ok: false, error: "capacity" };
  const startsAt = stockholmEventISO(input.eventDate, `${input.startTime}:00`);
  const endsAt = stockholmEventISO(input.eventDate, `${input.endTime}:00`);
  if ((ms(endsAt) - ms(startsAt)) / MIN < MIN_SHIFT_MINUTES) return { ok: false, error: "length" };
  return { ok: true, startsAt, endsAt };
}

/** Sista stund att avboka utan varning: kl. 10 samma dag, Stockholmstid. */
export function cancelDeadline(eventDate: string): string {
  return stockholmEventISO(eventDate, `${CANCEL_DEADLINE_TIME}:00`);
}

export function isLateCancel(eventDate: string, now: Date): boolean {
  return now.getTime() >= ms(cancelDeadline(eventDate));
}

export interface SignupFacts {
  status: "booked" | "cancelled";
  late_cancel: boolean;
  cancelled_at: string | null;
  checked_in_at: string | null;
  /** Passets slut. */
  ends_at: string;
}

/**
 * När anmälan blev en varning, eller null: en sen avbokning räknas från
 * avbokningen, ett uteblivet pass från passets slut.
 */
export function strikeAt(s: SignupFacts, now: Date): string | null {
  if (s.status === "cancelled") return s.late_cancel ? s.cancelled_at ?? s.ends_at : null;
  if (!s.checked_in_at && now.getTime() > ms(s.ends_at)) return s.ends_at;
  return null;
}

export function isStrike(s: SignupFacts, now: Date): boolean {
  return strikeAt(s, now) !== null;
}

function addMonths(iso: string, months: number): string {
  const d = new Date(iso);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString();
}

export interface StrikeStatus {
  /** Varningar som räknas just nu: inom sex månader och efter senaste nollställning. */
  active: number;
  /** Avstängd till och med, eller null. */
  suspendedUntil: string | null;
}

/**
 * Går igenom varningarna i tidsordning. Så fort tre ligger inom sex månader
 * börjar en avstängning på sex månader från den tredje, och allt före
 * avstängningens slut är därefter glömt.
 */
export function strikeStatus(signups: readonly SignupFacts[], now: Date): StrikeStatus {
  const times = signups
    .map((s) => strikeAt(s, now))
    .filter((t): t is string => t !== null)
    .sort();
  let resetAt = -Infinity;
  let suspendedUntil: string | null = null;
  let window: string[] = [];
  for (const t of times) {
    if (ms(t) < resetAt) continue;
    window = window.filter((w) => ms(w) > ms(addMonths(t, -STRIKE_WINDOW_MONTHS)));
    window.push(t);
    if (window.length >= STRIKE_LIMIT) {
      suspendedUntil = addMonths(t, SUSPENSION_MONTHS);
      resetAt = ms(suspendedUntil);
      window = [];
    }
  }
  const from = Math.max(resetAt, ms(addMonths(now.toISOString(), -STRIKE_WINDOW_MONTHS)));
  const active = times.filter((t) => ms(t) >= from && ms(t) <= now.getTime()).length;
  return {
    active,
    suspendedUntil: suspendedUntil && ms(suspendedUntil) > now.getTime() ? suspendedUntil : null,
  };
}

export function canCheckIn(shift: { starts_at: string; ends_at: string }, now: Date): boolean {
  const t = now.getTime();
  return t >= ms(shift.starts_at) - CHECKIN_EARLY_MINUTES * MIN && t <= ms(shift.ends_at);
}

export type DancerEligibility = "ok" | "bankid" | "bankidAgain" | "age";

/**
 * Får den här personen ta taxipass? Kräver Mobilt BankID (inte bara ett
 * äldre konto som släppts igenom utan), och att BankID-födelsedatumet ger
 * minst 18 år på kvällens datum. Verifierade före 2026-10-29 saknar
 * födelsedatum och får verifiera sig en gång till.
 */
export function dancerEligibility(
  p: { bankid_verified_at: string | null; bankid_birth_date: string | null },
  eventDate: string,
): DancerEligibility {
  if (!p.bankid_verified_at) return "bankid";
  if (!p.bankid_birth_date) return "bankidAgain";
  return ageOnDate(p.bankid_birth_date, eventDate) >= MIN_AGE ? "ok" : "age";
}

/** Kvällen har inte passerat i Stockholm. */
export function isUpcoming(eventDate: string, now: Date): boolean {
  return eventDate >= stockholmToday(now);
}
