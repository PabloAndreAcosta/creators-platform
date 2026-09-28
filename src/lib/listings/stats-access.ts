import type { SupabaseClient } from "@supabase/supabase-js";
import { hasVenueCapabilityForListing } from "@/lib/venues/listing-access";

/**
 * Hur mycket av statistiken får den här personen se?
 *
 * - "full"    — siffror OCH deltagarlista med namn och mejl. Ägaren,
 *               medarrangören (can_manage) och lokalteamets `stats`.
 * - "numbers" — bara siffrorna. Den nya can_view_stats.
 * - "none"    — ingenting.
 *
 * Skillnaden mellan full och numbers är hela poängen med behörigheten. Den som
 * ska följa försäljningen behöver veta HUR MÅNGA som köpt, inte VILKA. Gästernas
 * namn och mejladresser är deras, inte evenemangets, och de lämnas bara ut till
 * den som faktiskt hanterar gästerna.
 */
export type StatsAccess = "full" | "numbers" | "none";

interface CollabFlags {
  can_manage: boolean | null;
  can_view_stats: boolean | null;
}

/**
 * Nivån `userId` har på `listingId`. `ownerId` är listings.user_id och skickas
 * in av anroparen, som ändå har hämtat annonsen.
 *
 * Kräver en service-role-klient: RLS på listing_collaborators släpper bara
 * igenom värden och personen själv.
 */
export async function listingStatsAccess(
  admin: SupabaseClient,
  userId: string,
  listingId: string,
  ownerId: string
): Promise<StatsAccess> {
  if (userId === ownerId) return "full";

  const { data } = await admin
    .from("listing_collaborators")
    .select("can_manage, can_view_stats")
    .eq("listing_id", listingId)
    .eq("user_id", userId)
    .eq("status", "accepted")
    .maybeSingle();

  const collab = data as CollabFlags | null;

  // can_manage först: den som administrerar evenemanget har redan
  // deltagarlistan på andra sidor, så att hålla den borta här vore teater.
  if (collab?.can_manage) return "full";

  // Lokalens team med `stats` har samma insyn som en medarrangör.
  if (await hasVenueCapabilityForListing(admin, userId, listingId, "stats")) {
    return "full";
  }

  if (collab?.can_view_stats) return "numbers";

  return "none";
}

/** Får personen se statistiken alls? För enkla grindar som bara ska neka. */
export function mayViewStats(access: StatsAccess): boolean {
  return access !== "none";
}
