import { createAdminClient } from "@/lib/supabase/admin";

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
  const now = Date.now();
  if (cached && now - cached.at < TTL_MS) return cached.value;

  let value: MatchingAccess = "open"; // safe default: launch mode
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("app_config")
      .select("value")
      .eq("key", "matching_access")
      .maybeSingle();
    if (data?.value === "premium" || data?.value === "open") {
      value = data.value;
    }
  } catch {
    // fall back to the launch default on any read error
  }

  cached = { value, at: now };
  return value;
}

/** Test/ops helper: drop the in-process cache so the next read hits the DB. */
export function clearMatchingAccessCache() {
  cached = null;
}
