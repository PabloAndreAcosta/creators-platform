import type { SupabaseClient } from "@supabase/supabase-js";

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
  return !!data;
}
