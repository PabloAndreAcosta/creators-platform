import { createAdminClient } from "@/lib/supabase/admin";
import { assignmentRoute, type AssignmentRoute } from "./route";

/**
 * Väg per kreatör, för sidor som visar uppdrag.
 *
 * Bolagsfälten är inte läsbara för andra användare (profiles är låst per
 * kolumn), men en lokal måste få veta om den sökande anställs via Usha eller
 * fakturerar själv. Därför läses de med service-rollen — och bara de tre
 * fälten, och bara vägen lämnar funktionen. Anroparen ansvarar för att
 * tittaren har rätt att se personerna (eget gig, egen bokning).
 */
export async function loadAssignmentRoutes(ids: readonly string[]): Promise<Map<string, AssignmentRoute>> {
  const out = new Map<string, AssignmentRoute>();
  if (ids.length === 0) return out;
  const { data } = await createAdminClient()
    .from("profiles")
    .select("id, is_company, company_verified_at, is_usha_owned_seller")
    .in("id", [...new Set(ids)]);
  for (const p of data ?? []) {
    out.set(
      p.id,
      assignmentRoute({
        is_company: p.is_company ?? null,
        company_verified_at: p.company_verified_at ?? null,
        is_usha_owned_seller: p.is_usha_owned_seller ?? null,
      }),
    );
  }
  return out;
}
