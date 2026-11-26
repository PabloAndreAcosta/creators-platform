/**
 * Volontärens väg genom en kväll: 1 Ansök, 2 Välj pass, 3 Checka in.
 *
 * Efter The Lab 26 nov: en godkänd volontär valde aldrig pass, en annan bokade
 * men checkade aldrig in. Sidan visade varken var man stod eller vad nästa steg
 * var. Här räknas båda fram ur det sidan redan läser in, så att stegvisaren och
 * den stora knappen högst upp alltid säger samma sak.
 *
 * Rena funktioner. Tider in som ISO.
 */

import { canCheckIn, CHECKIN_EARLY_MINUTES, type DancerEligibility } from "./rules";
import type { ApprovalStatus } from "./approvals";

export type StepKey = "apply" | "choose" | "checkin";
export type StepState = "done" | "current" | "todo";

export interface BookedShift {
  signupId: string;
  starts_at: string;
  ends_at: string;
  checked_in_at: string | null;
}

export type NextAction =
  | { kind: "account" }
  | { kind: "bankid" }
  | { kind: "age" }
  | { kind: "blocked" }
  | { kind: "apply" }
  | { kind: "waiting" }
  | { kind: "declined" }
  | { kind: "choose" }
  | { kind: "noOpen" }
  | { kind: "checkInNow"; shift: BookedShift }
  | { kind: "checkInLater"; shift: BookedShift; opensAt: string }
  | { kind: "missed" }
  | { kind: "done" };

export interface JourneyInput {
  loggedIn: boolean;
  eligibility: DancerEligibility;
  /** Avstängd efter tre varningar. */
  blocked: boolean;
  /** Personens ansökningsstatus per roll som kvällen har pass i. */
  roleStatuses: readonly (ApprovalStatus | undefined)[];
  /** Personens bokade (ej avbokade) pass den här kvällen. */
  booked: readonly BookedShift[];
  /** Finns det pass kvar att boka i en roll personen är godkänd för? */
  hasOpenShifts: boolean;
  now: Date;
}

export interface Journey {
  steps: { key: StepKey; state: StepState }[];
  next: NextAction;
}

const ms = (iso: string) => Date.parse(iso);

/** Första pass som går att checka in på nu och inte är incheckat. */
export function shiftToCheckInNow(booked: readonly BookedShift[], now: Date): BookedShift | null {
  return (
    [...booked]
      .filter((b) => !b.checked_in_at && canCheckIn(b, now))
      .sort((a, b) => ms(a.starts_at) - ms(b.starts_at))[0] ?? null
  );
}

/** Nästa kommande pass utan incheckning, och när incheckningen öppnar. */
export function nextCheckIn(booked: readonly BookedShift[], now: Date): { shift: BookedShift; opensAt: string } | null {
  const shift = [...booked]
    .filter((b) => !b.checked_in_at && ms(b.starts_at) - CHECKIN_EARLY_MINUTES * 60_000 > now.getTime())
    .sort((a, b) => ms(a.starts_at) - ms(b.starts_at))[0];
  if (!shift) return null;
  return { shift, opensAt: new Date(ms(shift.starts_at) - CHECKIN_EARLY_MINUTES * 60_000).toISOString() };
}

export function volunteerJourney(i: JourneyInput): Journey {
  const approved = i.roleStatuses.includes("approved");
  const hasBooking = i.booked.length > 0;
  const now = i.now;
  const checkNow = shiftToCheckInNow(i.booked, now);
  const later = nextCheckIn(i.booked, now);
  // Alla pass som redan börjat är incheckade, och inget kommande väntar.
  const missed = i.booked.some((b) => !b.checked_in_at && ms(b.ends_at) < now.getTime());
  const allCheckedIn = hasBooking && !checkNow && !later && !missed;

  const applyState: StepState = approved || hasBooking ? "done" : i.loggedIn ? "current" : "todo";
  const chooseState: StepState = hasBooking ? "done" : approved ? "current" : "todo";
  const checkinState: StepState = allCheckedIn ? "done" : hasBooking ? "current" : "todo";
  const steps = [
    { key: "apply" as const, state: applyState },
    { key: "choose" as const, state: chooseState },
    { key: "checkin" as const, state: checkinState },
  ];

  let next: NextAction;
  if (!i.loggedIn) next = { kind: "account" };
  // Den som står i dörren ska alltid se knappen först.
  else if (checkNow) next = { kind: "checkInNow", shift: checkNow };
  else if (i.eligibility === "bankid" || i.eligibility === "bankidAgain") next = { kind: "bankid" };
  else if (i.eligibility === "age") next = { kind: "age" };
  else if (later && hasBooking) next = { kind: "checkInLater", shift: later.shift, opensAt: later.opensAt };
  else if (missed && !later) next = { kind: "missed" };
  else if (allCheckedIn) next = { kind: "done" };
  else if (i.blocked) next = { kind: "blocked" };
  else if (approved && !hasBooking) next = i.hasOpenShifts ? { kind: "choose" } : { kind: "noOpen" };
  else if (approved) next = { kind: "done" };
  else if (i.roleStatuses.includes("pending")) next = { kind: "waiting" };
  else if (i.roleStatuses.length > 0 && i.roleStatuses.every((s) => s === "declined")) next = { kind: "declined" };
  else next = { kind: "apply" };

  return { steps, next };
}
