import type { SupabaseClient } from "@supabase/supabase-js";

export type MatchRole = "user" | "creator" | "experience";

/**
 * Normalize the messy stored role values (sv/en mix) to a matching role.
 * customer/publik → user, creator/kreator → creator, upplevelse → experience.
 */
export function normalizeRole(role: string | null | undefined): MatchRole {
  switch ((role || "").toLowerCase()) {
    case "creator":
    case "kreator":
      return "creator";
    case "experience":
    case "upplevelse":
      return "experience";
    default:
      return "user";
  }
}

/** A tier string counts as Premium only when it is exactly the premium tier. */
export function isPremiumTier(tier: string | null | undefined): boolean {
  return (tier || "").toLowerCase() === "premium";
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
  const { data: profile } = await admin
    .from("profiles")
    .select("tier")
    .eq("id", userId)
    .maybeSingle();
  if (isPremiumTier(profile?.tier)) return true;

  const { data: sub } = await admin
    .from("subscriptions")
    .select("plan, status")
    .eq("user_id", userId)
    .in("status", ["active", "trialing"])
    .maybeSingle();
  if (sub && (sub.plan || "").toLowerCase().includes("premium")) return true;

  return false;
}
