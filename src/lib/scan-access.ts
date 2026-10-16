import type { SupabaseClient } from "@supabase/supabase-js";
import { hasVenueCapabilityForListing } from "@/lib/venues/listing-access";
import { isAdminById } from "@/lib/admin/check";

const PAID_TIERS = new Set(["guld", "premium"]);
// Account roles that count as creator/experience (both EN + SV spellings exist).
const PRO_ROLES = new Set(["creator", "creator", "venue", "venue"]);

/** Only Gold/Premium accounts may delegate ticket scanning to others. */
export function canDelegateScan(tier: string | null | undefined): boolean {
  return !!tier && PAID_TIERS.has(tier);
}

/**
 * Who may RECEIVE a scan delegation: a paying user (Gold/Premium) or a
 * creator/experience account — not a free public account.
 */
export function canReceiveScan(
  role: string | null | undefined,
  tier: string | null | undefined
): boolean {
  return (!!role && PRO_ROLES.has(role)) || (!!tier && PAID_TIERS.has(tier));
}

/**
 * Whether `userId` may scan/check-in tickets for `listingId` as a delegated
 * crew member — i.e. an accepted collaborator the host gave `can_scan` to.
 * The listing owner and admins are authorized separately by the callers.
 * Pass a service-role client (RLS on listing_collaborators is host/self-only).
 */
export async function canScanListing(
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
    .eq("can_scan", true)
    .maybeSingle();
  if (data) return true;

  return hasVenueCapabilityForListing(admin, userId, listingId, "scan");
}

/**
 * Får `userId` sköta entrén för kvällen — alltså sälja i dörren, visa
 * QR-koder och skapa efterköp?
 *
 * Ägaren, en admin eller en crew-medlem med can_scan. Kontrollen låg tidigare
 * utskriven på varje ruta som behövde den, i identiska kopior. En
 * säkerhetskontroll som finns på tre ställen är en kontroll som förr eller
 * senare skiljer sig åt på ett av dem, och just den här avgör vem som kan ta
 * betalt i Ushas namn.
 *
 * Kräver en service-role-klient: RLS på listing_collaborators släpper bara
 * igenom värden och personen själv.
 */
export async function canOperateEntrance(
  admin: SupabaseClient,
  userId: string,
  listing: { id: string; user_id: string }
): Promise<boolean> {
  if (listing.user_id === userId) return true;
  if (await isAdminById(userId)) return true;
  return canScanListing(admin, userId, listing.id);
}
