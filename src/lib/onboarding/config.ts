/**
 * Tunable parameters for the onboarding/payment domain.
 *
 * NOTE: real payments must NOT be activated until the legal questions in §9 of
 * Usha_byggspec_onboarding.md are confirmed. PAYMENTS_LIVE stays false here and
 * the adapters are all mocks (see ./adapters).
 */

/** Hard kill-switch: no real money movement while false. */
export const PAYMENTS_LIVE = false;

/**
 * G2: an F-skatt check older than this forces a re-check before a C1 payout.
 * Spec leaves "X dagar" open; 30 days is a conservative default — adjust once
 * the Skatteverket integration cadence is confirmed.
 */
export const FSKATT_MAX_AGE_DAYS = 30;

/**
 * Sentinel id representing Usha AB's own account. G4: amount_gross must never be
 * credited here — only `commission` may land on this account.
 */
export const USHA_ACCOUNT_ID = "usha-ab";

export class Section9NotClearedError extends Error {
  constructor(op: string) {
    super(
      `§9 gate: "${op}" is a real-money operation and is blocked until the legal questions in §9 of Usha_byggspec_onboarding.md are confirmed by a payment/tax lawyer (PAYMENTS_LIVE is false).`,
    );
    this.name = "Section9NotClearedError";
  }
}

/**
 * The §9 legal gate. ANY operation that moves real money (charges, transfers,
 * payouts, escrow release) must call this first. Onboarding/profile persistence
 * does NOT move money and is therefore allowed without clearance.
 */
export function assertSection9Cleared(op: string): void {
  if (!PAYMENTS_LIVE) {
    throw new Section9NotClearedError(op);
  }
}
