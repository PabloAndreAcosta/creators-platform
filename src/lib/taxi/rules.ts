/**
 * Taxipass: regler för volontärpass som taxidansare på en kväll.
 *
 * En taxidansare är VOLONTÄR. Hen får ingen lön, bara fri entré och en
 * matkupong (burgare + alkoholfri dryck) per kväll. Passen ligger mellan
 * 17 och 23 och är minst två timmar, och dansaren väljer själv vilka pass
 * hen tar. Alkoholfritt under passet, och den som anmäler sig ska ha fyllt 18.
 *
 * Avbokning ska ske före dygnets slut dagen före kvällen. Sen avbokning
 * eller uteblivet pass ger en varning; tre varningar hos samma arrangör (eller
 * i samma serie, t.ex. The Lab) och man kan inte längre anmäla sig där.
 * Varningarna räknas fram ur passen — det finns ingen räknare som kan glida
 * isär från det som faktiskt hände.
 *
 * Rena funktioner. Tider in som ISO, Stockholmstid räknas här.
 */

import { stockholmEventISO, stockholmToday } from "@/lib/time";

export const TAXI_WINDOW = { from: "17:00", to: "23:00" } as const;
export const MIN_SHIFT_MINUTES = 120;
export const STRIKE_LIMIT = 3;
export const MIN_AGE = 18;
/** Incheckning öppnar så här långt innan passet. */
export const CHECKIN_EARLY_MINUTES = 30;
/** Utcheckning går att göra så här länge efter passets slut. */
export const CHECKOUT_LATE_MINUTES = 60;
/** Ett pass räknas som fullföljt om högst så här mycket fattas. */
export const SHORT_TOLERANCE_MINUTES = 15;

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

/**
 * Sista stund att avboka utan varning: dygnets slut dagen före kvällen, alltså
 * när kvällens datum börjar i Stockholm.
 */
export function cancelDeadline(eventDate: string): string {
  return stockholmEventISO(eventDate, "00:00:00");
}

export function isLateCancel(eventDate: string, now: Date): boolean {
  return now.getTime() >= ms(cancelDeadline(eventDate));
}

export interface SignupFacts {
  status: "booked" | "cancelled";
  late_cancel: boolean;
  checked_in_at: string | null;
  /** Passets slut. */
  ends_at: string;
}

/** Sen avbokning eller ett pass som tog slut utan incheckning. */
export function isStrike(s: SignupFacts, now: Date): boolean {
  if (s.status === "cancelled") return s.late_cancel;
  return !s.checked_in_at && now.getTime() > ms(s.ends_at);
}

export function strikeCount(signups: readonly SignupFacts[], now: Date): number {
  return signups.filter((s) => isStrike(s, now)).length;
}

export function isBlocked(signups: readonly SignupFacts[], now: Date): boolean {
  return strikeCount(signups, now) >= STRIKE_LIMIT;
}

export function canCheckIn(shift: { starts_at: string; ends_at: string }, now: Date): boolean {
  const t = now.getTime();
  return t >= ms(shift.starts_at) - CHECKIN_EARLY_MINUTES * MIN && t <= ms(shift.ends_at);
}

export function canCheckOut(
  signup: { checked_in_at: string | null; checked_out_at: string | null },
  shift: { ends_at: string },
  now: Date,
): boolean {
  return !!signup.checked_in_at && !signup.checked_out_at && now.getTime() <= ms(shift.ends_at) + CHECKOUT_LATE_MINUTES * MIN;
}

/** Minuter mellan in- och utcheckning, räknat inom passets tid. */
export function workedMinutes(
  signup: { checked_in_at: string | null; checked_out_at: string | null },
  shift: { starts_at: string; ends_at: string },
): number | null {
  if (!signup.checked_in_at || !signup.checked_out_at) return null;
  const from = Math.max(ms(signup.checked_in_at), ms(shift.starts_at));
  const to = Math.min(ms(signup.checked_out_at), ms(shift.ends_at));
  return Math.max(0, Math.round((to - from) / MIN));
}

/** Passet fullföljdes inte: kortare än passet minus toleransen. */
export function isShort(
  signup: { checked_in_at: string | null; checked_out_at: string | null },
  shift: { starts_at: string; ends_at: string },
): boolean {
  const worked = workedMinutes(signup, shift);
  if (worked === null) return false;
  const length = (ms(shift.ends_at) - ms(shift.starts_at)) / MIN;
  return worked < length - SHORT_TOLERANCE_MINUTES;
}

/**
 * Ålder på ett datum ur ett BankID-personnummer (ÅÅÅÅMMDD-NNNN eller
 * ÅÅÅÅMMDDNNNN). Samordningsnummer har dag + 60. Okänt format → null, och då
 * får dansaren intyga åldern själv.
 */
export function ageOn(personalNumber: string | null | undefined, date: string): number | null {
  const m = (personalNumber ?? "").replace(/\D/g, "").match(/^(\d{4})(\d{2})(\d{2})\d{4}$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]) > 60 ? Number(m[3]) - 60 : Number(m[3]);
  const [ty, tm, td] = date.split("-").map(Number);
  let age = ty - y;
  if (tm < mo || (tm === mo && td < d)) age--;
  return age;
}

/** Kvällen har inte passerat i Stockholm. */
export function isUpcoming(eventDate: string, now: Date): boolean {
  return eventDate >= stockholmToday(now);
}
