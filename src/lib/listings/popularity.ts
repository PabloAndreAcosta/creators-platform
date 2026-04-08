import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Fetch booking counts for a list of listing IDs.
 * Returns a map of listingId → bookingCount.
 */
export async function getBookingCounts(
  supabase: SupabaseClient,
  listingIds: string[]
): Promise<Record<string, number>> {
  if (listingIds.length === 0) return {};

  const { data } = await supabase
    .from("bookings")
    .select("listing_id")
    .in("listing_id", listingIds)
    .in("status", ["pending", "confirmed", "completed"]);

  const counts: Record<string, number> = {};
  (data || []).forEach((b) => {
    counts[b.listing_id] = (counts[b.listing_id] || 0) + 1;
  });
  return counts;
}

/**
 * Sort listings with promoted first, then by provided order.
 * Expired promotions are treated as non-promoted.
 */
export function sortWithPromoted<
  T extends { is_promoted?: boolean; promoted_until?: string | null },
>(listings: T[]): T[] {
  const now = new Date();
  return [...listings].sort((a, b) => {
    const aPromoted = a.is_promoted && (!a.promoted_until || new Date(a.promoted_until) > now);
    const bPromoted = b.is_promoted && (!b.promoted_until || new Date(b.promoted_until) > now);
    if (aPromoted && !bPromoted) return -1;
    if (!aPromoted && bPromoted) return 1;
    return 0; // preserve existing order for same promoted status
  });
}

/**
 * Check if a listing is currently promoted (not expired).
 */
export function isActivelyPromoted(listing: {
  is_promoted?: boolean;
  promoted_until?: string | null;
}): boolean {
  if (!listing.is_promoted) return false;
  if (!listing.promoted_until) return true;
  return new Date(listing.promoted_until) > new Date();
}
