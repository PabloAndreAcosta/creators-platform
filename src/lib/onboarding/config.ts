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
