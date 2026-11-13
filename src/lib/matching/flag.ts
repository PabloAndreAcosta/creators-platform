export type MatchingAccess = "open" | "premium";

/**
 * Reads the `matching_access` feature flag from app_config (service_role).
 *
 * - "open"    → every authenticated user gets matches (launch period).
 * - "premium" → only Premium-tier users get match content; others get a
 *               locked teaser (count only). Flip the flag in app_config to
 *               switch — no deploy required; takes effect within the cache TTL.
 *
 * Cached in-process for 5 minutes so the flag (and tier-gating downstream)
 * adds at most one lightweight query per cold lambda per 5 min.
 */
const TTL_MS = 5 * 60_000;
let cached: { value: MatchingAccess; at: number } | null = null;

export async function getMatchingAccess(): Promise<MatchingAccess> {
  // En nivå sedan 2026-11-13: Guld och Premium är borta, allt ingår för alla.
  // Flaggan i app_config läses inte längre: det finns ingen Premium att
  // begränsa till, så matchningen är öppen för alla inloggade.
  const now = Date.now();
  if (cached && now - cached.at < TTL_MS) return cached.value;
  const value: MatchingAccess = "open";
  cached = { value, at: now };
  return value;
}

/** Test/ops helper: drop the in-process cache so the next read hits the DB. */
export function clearMatchingAccessCache() {
  cached = null;
}
