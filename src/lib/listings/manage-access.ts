import type { SupabaseClient } from "@supabase/supabase-js";
import { hasVenueCapabilityForListing } from "@/lib/venues/listing-access";

const PAID_TIERS = new Set(["guld", "premium"]);

/** Only Gold/Premium owners may delegate co-organizer (manage) rights. */
export function canDelegateManage(tier: string | null | undefined): boolean {
  return !!tier && PAID_TIERS.has(tier);
}

/**
 * Whether `userId` may ADMINISTER `listingId` as a co-organizer — an accepted
 * collaborator the owner granted `can_manage`. This authorizes event admin
 * (edit / broadcast / stats / export / crew / access codes) — NEVER money or
 * ownership (checkout, gage pay, payouts, hard-delete and ownership transfer
 * stay owner-only). Pass a service-role client: RLS on listing_collaborators is
 * host/self-only.
 */
export async function canManageListing(
  admin: SupabaseClient,
  userId: string,
  listingId: string
): Promise<boolean> {
  const { data } = await admin
    .from("listing_collaborators")
    .select("id")
    .eq("listing_id", listingId)
    .eq("user_id", userId)
    .eq("status", "accepted")
    .eq("can_manage", true)
    .maybeSingle();
  if (data) return true;

  return hasVenueCapabilityForListing(admin, userId, listingId, "events");
}

/**
 * Owner-or-co-organizer gate for event ADMIN actions. `ownerId` is
 * listing.user_id. Returns true for the owner or an accepted can_manage
 * collaborator. Do NOT use for money/ownership actions.
 */
export async function isOwnerOrManager(
  admin: SupabaseClient,
  userId: string,
  listingId: string,
  ownerId: string
): Promise<boolean> {
  if (userId === ownerId) return true;
  return canManageListing(admin, userId, listingId);
}
