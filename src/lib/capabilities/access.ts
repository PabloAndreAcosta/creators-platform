import type { SupabaseClient } from "@supabase/supabase-js";
import { PACK_INCLUDES, type Capability } from "./config";

// Paid tiers grant every event capability for free; everyone else unlocks
// per-event with nycklar (the token alternative to a subscription).
const TIER_GRANTS_ALL = new Set(["guld", "premium"]);

export function tierGrants(tier: string | null | undefined): boolean {
  return TIER_GRANTS_ALL.has((tier || "").toLowerCase());
}

/**
 * Whether a profile may use `cap` (optionally for a specific listing):
 * their tier grants it, OR an active unlock whose pack includes it exists.
 * Event-scope unlocks are matched to the listing and are locked-active (never
 * revoked mid-event); period-scope unlocks are matched by expiry.
 *
 * Use with the admin (service-role) client from server routes — never gate the
 * buyer checkout flow with this.
 */
export async function hasCapability(
  admin: SupabaseClient,
  profileId: string,
  cap: Capability,
  listingId?: string | null
): Promise<boolean> {
  const { data: profile } = await admin
    .from("profiles")
    .select("tier")
    .eq("id", profileId)
    .maybeSingle();
  if (tierGrants(profile?.tier)) return true;

  const { data: unlocks } = await admin
    .from("capability_unlocks")
    .select("capability, scope, listing_id, expires_at")
    .eq("profile_id", profileId);

  const now = Date.now();
  return (unlocks ?? []).some((u) => {
    if (!(PACK_INCLUDES[u.capability] ?? []).includes(cap)) return false;
    if (u.scope === "event") return !listingId || u.listing_id === listingId;
    if (u.scope === "period") return !u.expires_at || new Date(u.expires_at).getTime() > now;
    return false;
  });
}
