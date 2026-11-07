import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Vilka får ta emot en andel av kvällens biljettintäkt: den kopplade lokalen
 * och accepterade medarrangörer i crew. Arrangören själv är aldrig partner —
 * hen får resten ändå.
 *
 * Ligger utanför actions.ts med flit: en exporterad funktion i en "use
 * server"-fil blir en server action som går att anropa från klienten.
 */
export async function allowedPartnerIds(
  admin: Admin,
  listing: { id: string; user_id: string; venue_profile_id: string | null }
): Promise<Set<string>> {
  const ids = new Set<string>();
  if (listing.venue_profile_id) ids.add(listing.venue_profile_id);
  const { data: crew } = await admin
    .from("listing_collaborators")
    .select("user_id")
    .eq("listing_id", listing.id)
    .eq("status", "accepted");
  for (const c of crew ?? []) if (c.user_id) ids.add(c.user_id);
  ids.delete(listing.user_id);
  return ids;
}
