import type { SupabaseClient } from "@supabase/supabase-js";

export interface VenueOption {
  id: string;
  name: string;
}

/**
 * Lokaler som ett evenemang kan kopplas till.
 *
 * Bolagsnamnet går före personnamnet: en lokal känns igen på sitt skyltnamn,
 * inte på vem som råkar äga kontot.
 */
export async function listVenueOptions(supabase: SupabaseClient): Promise<VenueOption[]> {
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, company_name")
    .eq("role", "venue");

  return (data ?? [])
    .map((p: { id: string; full_name: string | null; company_name: string | null }) => ({
      id: p.id,
      name: (p.company_name || p.full_name || "").trim(),
    }))
    .filter((v) => v.name.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "sv"));
}
