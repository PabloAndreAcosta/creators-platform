import { createAdminClient } from "@/lib/supabase/admin";

export interface VenueOption {
  id: string;
  name: string;
}

/**
 * Lokaler som ett evenemang kan kopplas till.
 *
 * LÄSES VIA SERVICE-ROLE, inte användarens klient. RLS på profiles släpper bara
 * igenom den egna raden och publicerade profiler, så frågan gav noll rader —
 * väljaren renderades aldrig och ingen kunde välja någon lokal alls. Felet var
 * tyst: en tom lista ser likadan ut som "det finns inga lokaler".
 *
 * VILKA SOM SYNS. En lokal blir valbar när den antingen publicerat sin profil
 * ELLER verifierat sitt bolag. Båda är aktiva val som säger "vi vill hittas".
 * Ett konto som råkat få rollen venue men aldrig gjort något av det hamnar inte
 * i en rullgardin hos alla andra.
 *
 * Det som exponeras är skyltnamnet och ingenting annat — inte mejladress, inte
 * något om kontot. För en verifierad lokal är namnet dessutom redan offentligt i
 * bolagsregistret.
 *
 * Bolagsnamnet går före personnamnet: en lokal känns igen på sitt skyltnamn,
 * inte på vem som råkar äga kontot.
 */
export async function listVenueOptions(): Promise<VenueOption[]> {
  const { data } = await createAdminClient()
    .from("profiles")
    .select("id, full_name, company_name, is_public, company_verified_at")
    .eq("role", "venue");

  return (data ?? [])
    .filter(
      (p: { is_public: boolean | null; company_verified_at: string | null }) =>
        p.is_public === true || p.company_verified_at != null
    )
    .map((p: { id: string; full_name: string | null; company_name: string | null }) => ({
      id: p.id,
      name: (p.company_name || p.full_name || "").trim(),
    }))
    .filter((v) => v.name.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "sv"));
}
