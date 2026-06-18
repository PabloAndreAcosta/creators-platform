/**
 * Booking & payout state machines (§6).
 *
 * Booking:  requested → accepted → in_escrow → completed → settled
 *           (+ disputed, cancelled, refunded)
 * Payout:   pending → held(PSP/EOR) → released → paid
 *           (+ blocked, failed)
 *
 * Escrow lifecycle: accepted → funds pulled & held at PSP/EOR (in_escrow) →
 * marked completed → split + released → paid.
 */

import type { BookingStatus, PayoutState } from "./types";

const BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  requested: ["accepted", "cancelled"],
  accepted: ["in_escrow", "cancelled"],
  in_escrow: ["completed", "disputed", "refunded"],
  completed: ["settled", "disputed"],
  settled: [],
  disputed: ["refunded", "settled"],
  cancelled: [],
  refunded: [],
};

const PAYOUT_TRANSITIONS: Record<PayoutState, PayoutState[]> = {
  pending: ["held", "blocked", "failed"],
  held: ["released", "blocked", "failed"],
  released: ["paid", "failed"],
  paid: [],
  blocked: ["pending"], // can retry after the block is resolved (e.g. F-skatt re-check)
  failed: ["pending"],
};

export function canTransitionBooking(from: BookingStatus, to: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[from]?.includes(to) ?? false;
}

export function canTransitionPayout(from: PayoutState, to: PayoutState): boolean {
  return PAYOUT_TRANSITIONS[from]?.includes(to) ?? false;
}

export class StateTransitionError extends Error {
  constructor(kind: string, from: string, to: string) {
    super(`Invalid ${kind} transition: ${from} → ${to}`);
    this.name = "StateTransitionError";
  }
}

export function transitionBooking(from: BookingStatus, to: BookingStatus): BookingStatus {
  if (!canTransitionBooking(from, to)) throw new StateTransitionError("booking", from, to);
  return to;
}

export function transitionPayout(from: PayoutState, to: PayoutState): PayoutState {
  if (!canTransitionPayout(from, to)) throw new StateTransitionError("payout", from, to);
  return to;
}

export const BOOKING_TERMINAL: BookingStatus[] = ["settled", "cancelled", "refunded"];
export const PAYOUT_TERMINAL: PayoutState[] = ["paid"];
