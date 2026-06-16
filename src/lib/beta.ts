/**
 * Beta mode — when active, all paid features are unlocked for everyone.
 *
 * Two controls, ANDed together:
 *  - NEXT_PUBLIC_BETA_MODE === "true"  — master switch (kill switch).
 *  - NEXT_PUBLIC_BETA_END_DATE         — optional ISO timestamp. Beta auto-ends
 *    at this instant; afterwards tier gating (Gratis/Guld/Premium) is enforced.
 *
 * Note: NEXT_PUBLIC_* values are inlined into the client bundle at build time,
 * so on the client the end-date is evaluated at build time. A redeploy is
 * scheduled on the end date to re-inline the flipped value; server runtime
 * re-evaluates on each cold start, so server-side enforcement flips on its own.
 */
const BETA_SWITCH_ON = process.env.NEXT_PUBLIC_BETA_MODE === "true";

/** The beta end instant in ms, or NaN when unset/invalid (→ no auto-end). */
export const BETA_END_MS = process.env.NEXT_PUBLIC_BETA_END_DATE
  ? new Date(process.env.NEXT_PUBLIC_BETA_END_DATE).getTime()
  : NaN;

const beforeBetaEnd = Number.isNaN(BETA_END_MS) || Date.now() < BETA_END_MS;

export const BETA_MODE = BETA_SWITCH_ON && beforeBetaEnd;

/** ISO date (yyyy-mm-dd) the beta ends, or null. For display on landing/billing. */
export const BETA_END_DATE: string | null = Number.isNaN(BETA_END_MS)
  ? null
  : new Date(BETA_END_MS).toISOString().slice(0, 10);
