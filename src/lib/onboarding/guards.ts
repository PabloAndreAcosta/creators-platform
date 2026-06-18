/**
 * Business-rule guards G1–G7 (§7). These are the hard, non-negotiable rules and
 * must not be coded away. Pure functions — easy to unit-test and to call from any
 * layer (router, payout pipeline, webhook). No side effects.
 */

import { FSKATT_MAX_AGE_DAYS, USHA_ACCOUNT_ID } from "./config";
import type {
  Booking,
  CreatorProfile,
  Dac7Record,
  Payout,
  Track,
  User,
  VenueTrack,
} from "./types";

export interface GuardResult {
  allowed: boolean;
  /** Machine-readable code, e.g. "G2_FSKATT_STALE". */
  code?: string;
  /** Human-readable reason (sv). */
  reason?: string;
}

const OK: GuardResult = { allowed: true };

// ─── G1 · BankID gate (§1.3) ──────────────────────────────────────────────────
// No profile may be created without a verified BankID.

export function checkBankIdGate(user: Pick<User, "bankid_verified">): GuardResult {
  if (!user.bankid_verified) {
    return { allowed: false, code: "G1_BANKID_REQUIRED", reason: "BankID krävs innan något annat." };
  }
  return OK;
}

// ─── G2 · F-skatt gate (§7 G2) ────────────────────────────────────────────────
// A C1 payout is blocked if F-skatt is not active, or the check is too old.

export function isFskattCheckStale(checkedAt: string | null, now: Date = new Date()): boolean {
  if (!checkedAt) return true;
  const ageMs = now.getTime() - new Date(checkedAt).getTime();
  return ageMs > FSKATT_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
}

export function checkFskattForPayout(
  profile: Pick<CreatorProfile, "track" | "fskatt_status" | "fskatt_checked_at">,
  now: Date = new Date(),
): GuardResult {
  if (profile.track !== "C1") return OK; // F-skatt only governs the self-employed track
  if (profile.fskatt_status !== "active") {
    return { allowed: false, code: "G2_FSKATT_INACTIVE", reason: "F-skatt är inte aktiv – utbetalning blockeras." };
  }
  if (isFskattCheckStale(profile.fskatt_checked_at, now)) {
    return { allowed: false, code: "G2_FSKATT_STALE", reason: "F-skattekontrollen är för gammal – ny kontroll krävs." };
  }
  return OK;
}

// ─── G3 · Volunteer lock (§1.6, §7 G3) ────────────────────────────────────────
// A volunteer (C3) can ONLY receive an expense reimbursement, never a payout > 0.
// Volunteer status is decided by the ABSENCE of compensation/benefit, never by
// role label — so the eligibility test takes a "receives compensation/benefit"
// boolean, NOT a role. Benefits (gager, gifts, products, free entry) count as
// compensation and disqualify the volunteer track. We deliberately never list
// paid roles (e.g. taxi dancers, influencers) as volunteer examples.

/** True only if the person receives no compensation AND no benefit. */
export function isVolunteerEligible(receivesCompensationOrBenefit: boolean): boolean {
  return !receivesCompensationOrBenefit;
}

export function checkVolunteerPayout(track: Track, payout: Pick<Payout, "kind" | "gross">): GuardResult {
  if (track !== "C3") return OK;
  if (payout.kind === "expense_reimbursement") return OK;
  if (payout.gross > 0) {
    return {
      allowed: false,
      code: "G3_VOLUNTEER_PAYOUT_BLOCKED",
      reason: "Volontär kan bara få utlägg mot kvitto. Byt till lön (C2) eller eget företag (C1) för ersättning.",
    };
  }
  return OK;
}

// ─── G4 · Money path (§1.1, §7 G4) ────────────────────────────────────────────
// Gross money must never be credited to Usha. Only `commission` may land on
// Usha's account. We model the booking's release as ledger entries and assert it.

export type LedgerKind = "gross" | "commission" | "net" | "tax" | "fees";
export interface LedgerEntry {
  account: string;
  credit: number;
  kind: LedgerKind;
}

/**
 * Builds the credit ledger for releasing a booking: commission → Usha, the rest
 * (net) → the creator/EOR account. Gross is held at the PSP/EOR (§1.2) and is
 * NEVER credited to Usha.
 */
export function buildReleaseLedger(
  booking: Pick<Booking, "amount_gross" | "commission">,
  payeeAccount: string,
): LedgerEntry[] {
  const net = booking.amount_gross - booking.commission;
  return [
    { account: USHA_ACCOUNT_ID, credit: booking.commission, kind: "commission" },
    { account: payeeAccount, credit: net, kind: "net" },
  ];
}

export function checkMoneyPath(
  entries: LedgerEntry[],
  expectedCommission: number,
): GuardResult {
  const ushaEntries = entries.filter((e) => e.account === USHA_ACCOUNT_ID);
  // Usha may only ever be credited commission.
  const nonCommissionToUsha = ushaEntries.find((e) => e.kind !== "commission");
  if (nonCommissionToUsha) {
    return {
      allowed: false,
      code: "G4_GROSS_TO_USHA",
      reason: `Otillåten kreditering till Usha (${nonCommissionToUsha.kind}). Endast provision får krediteras Usha.`,
    };
  }
  const ushaTotal = ushaEntries.reduce((s, e) => s + e.credit, 0);
  if (Math.round(ushaTotal * 100) !== Math.round(expectedCommission * 100)) {
    return {
      allowed: false,
      code: "G4_COMMISSION_MISMATCH",
      reason: "Beloppet till Usha matchar inte provisionen.",
    };
  }
  return OK;
}

// ─── G5 · Track switch (§7 G5) ────────────────────────────────────────────────
// A user may switch track; history is preserved; future bookings follow the new
// track. We return the change record so the caller can append it to history.

export interface TrackChange {
  from: Track;
  to: Track;
  at: string;
}

export function switchTrack(
  current: Track,
  next: Track,
  at: string,
): { track: Track; change: TrackChange | null } {
  if (current === next) return { track: current, change: null };
  return { track: next, change: { from: current, to: next, at } };
}

// ─── G6 · VAT flag (§7 G6) ────────────────────────────────────────────────────
// V2 (association, not VAT-registered) → the booking is flagged so VAT is
// computed on the commission only ("annans namn"), not on the whole gage.

export function vatOnCommissionOnly(
  venueTrack: VenueTrack,
  venueVatRegistered: boolean,
): boolean {
  return venueTrack === "V2" && !venueVatRegistered;
}

// ─── G7 · DAC7 log (§1.4, §7 G7) ──────────────────────────────────────────────
// Every settled booking creates/updates a Dac7Record for the seller. Per
// principle §1.4 we log ALL tracks (incl. C2 employees). NOTE §9.3: whether
// employees fall outside DAC7 is an open legal question — if confirmed, C2 can be
// excluded here without touching the rest of the flow.

export function quarterOf(date: Date): number {
  return Math.floor(date.getMonth() / 3) + 1;
}

export function dac7RecordForSettled(
  booking: Pick<Booking, "amount_gross" | "completed_at" | "created_at">,
  sellerId: string,
  currency = "SEK",
  now: Date = new Date(),
): Dac7Record {
  const when = new Date(booking.completed_at ?? booking.created_at ?? now.toISOString());
  return {
    seller_id: sellerId,
    quarter: quarterOf(when),
    year: when.getFullYear(),
    consideration: booking.amount_gross,
    currency,
  };
}

/** Merges a new settled booking's consideration into an existing quarter record. */
export function mergeDac7(existing: Dac7Record | null, addition: Dac7Record): Dac7Record {
  if (!existing) return addition;
  return { ...existing, consideration: existing.consideration + addition.consideration };
}
