import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizeCapabilities, type VenueCapability } from "./members";

/**
 * Har `userId` den här behörigheten på evenemanget, i egenskap av medlem i
 * lokalens team?
 *
 * VIKTIG AVGRÄNSNING, densamma som för `events`: behörigheten gäller evenemang
 * lokalen ÄGER, inte evenemang som bara äger rum där. Att Bacchi upplåter sin
 * källare åt någon annans danskväll ska inte ge Bacchis dörrvärd rätt att
 * checka in den arrangörens gäster — det är arrangörens beslut, och hen kan
 * fatta det med den crew-inbjudan som redan finns per evenemang.
 *
 * Därför matchas listings.user_id mot lokalen, aldrig venue_profile_id.
 */
export async function hasVenueCapabilityForListing(
  admin: SupabaseClient,
  userId: string,
  listingId: string,
  capability: VenueCapability
): Promise<boolean> {
  const { data: listing } = await admin
    .from("listings")
    .select("user_id")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing?.user_id) return false;

  // Ägaren av lokalen fångas av anroparens egen ägarkontroll.
  if (listing.user_id === userId) return true;

  const { data: member } = await admin
    .from("venue_members")
    .select("capabilities, accepted_at, removed_at")
    .eq("venue_profile_id", listing.user_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!member || !member.accepted_at || member.removed_at) return false;
  return sanitizeCapabilities(member.capabilities).includes(capability);
}
