import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizeCapabilities } from "@/lib/venues/members";

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

  return canManageAsVenueMember(admin, userId, listingId);
}

/**
 * Får `userId` administrera evenemanget i egenskap av medlem i lokalens team?
 *
 * VIKTIG AVGRÄNSNING: behörigheten gäller evenemang lokalen ÄGER, inte evenemang
 * som bara äger rum där. Att Bacchi bekräftar att någon annans danskväll hålls i
 * deras källare är att upplåta lokal — inte att ta över arrangemanget. Därför
 * matchas `listings.user_id` mot lokalen, aldrig `venue_profile_id`.
 *
 * Den som vill släppa in lokalens folk i sitt eget evenemang gör det med den
 * medarrangörsinbjudan som redan finns, per evenemang.
 */
async function canManageAsVenueMember(
  admin: SupabaseClient,
  userId: string,
  listingId: string
): Promise<boolean> {
  const { data: listing } = await admin
    .from("listings")
    .select("user_id")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing?.user_id) return false;

  // Ägaren av lokalen fångas redan av isOwnerOrManager. Här handlar det om
  // någon annan som tillhör lokalens team.
  if (listing.user_id === userId) return true;

  const { data: member } = await admin
    .from("venue_members")
    .select("capabilities, accepted_at, removed_at")
    .eq("venue_profile_id", listing.user_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!member || !member.accepted_at || member.removed_at) return false;
  return sanitizeCapabilities(member.capabilities).includes("events");
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
