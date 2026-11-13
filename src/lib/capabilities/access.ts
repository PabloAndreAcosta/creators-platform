import type { SupabaseClient } from "@supabase/supabase-js";
import type { Capability } from "./config";

// En nivå sedan 2026-11-13: Guld och Premium är borta, allt ingår för alla.
// Nycklarna (per-event-upplåsning med tokens) har därmed inget kvar att låsa
// upp; koden ligger kvar tills den städas, men ingen grind frågar efter dem.
export function tierGrants(tier: string | null | undefined): boolean {
  void tier;
  return true;
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
  void admin;
  void profileId;
  void cap;
  void listingId;
  return true;
}
