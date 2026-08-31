"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Lokalens ja eller nej till att ett evenemang kopplas till den.
 *
 * Skrivningen går via RPC:n confirm_venue_listing och inte via en UPDATE, av en
 * anledning värd att komma ihåg: lokalen äger inte evenemanget. En RLS-policy
 * bred nog att låta lokalen bekräfta hade också låtit den ändra pris och titel
 * på någon annans arrangemang. Funktionen rör en enda kolumn, och bara på rader
 * där lokalen är den utpekade.
 */
export async function respondToVenueRequest(listingId: string, confirm: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Ej inloggad" };

  const { error } = await supabase.rpc("confirm_venue_listing", {
    p_listing: listingId,
    p_confirm: confirm,
  });

  if (error) return { error: error.message };

  revalidatePath("/app/venue-requests");
  return {};
}
