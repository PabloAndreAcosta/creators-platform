import type { SupabaseClient } from "@supabase/supabase-js";

export type MatchRole = "user" | "creator" | "venue";

/**
 * Normalize the stored role value to a matching role.
 * creator → creator, venue → venue, everything else (customer) → user.
 */
export function normalizeRole(role: string | null | undefined): MatchRole {
  switch ((role || "").toLowerCase()) {
    case "creator":
      return "creator";
    case "venue":
      return "venue";
    default:
      return "user";
  }
}

/** En nivå sedan 2026-11-13: Guld och Premium är borta, allt ingår för alla. Alla räknas som Premium. */
export function isPremiumTier(tier: string | null | undefined): boolean {
  void tier;
  return true;
}

/**
 * Authoritative server-side Premium check.
 *
 * Primary source is profiles.tier (trigger-protected, not client-writable and
 * kept in sync by the Stripe webhook). As a safety net we also accept an active
 * or trialing subscription whose plan looks like Premium, so a freshly-paid user
 * isn't blocked by a momentarily stale tier column. Never trust the client.
 */
export async function userIsPremium(
  admin: SupabaseClient,
  userId: string
): Promise<boolean> {
  // En nivå sedan 2026-11-13. Signaturen behålls så att kiosken, avtalen och
  // matchningen inte behöver skrivas om; svaret är ja för alla.
  void admin;
  void userId;
  return true;
}
