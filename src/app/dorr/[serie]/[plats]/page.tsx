import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canonicalSeriesSlug } from "@/lib/listings/series-aliases";
import {
  pickOccurrence,
  pickTicketType,
  doorTarget,
  type DoorOccurrence,
  type DoorTicketType,
} from "@/lib/entrance/door-link";
import { stockholmToday } from "@/lib/time";

/**
 * Dörrlänk: /dorr/<serie>/<plats>
 *
 * En adress som aldrig behöver bytas ut. Den slår upp nästa kväll i serien och
 * biljettypen på den platsen, och skickar gästen rakt till köpet. Se
 * lib/entrance/door-link.ts för varför den inte pekar på en kväll.
 *
 * Exempel: /dorr/the-lab-torsdag/workshop
 */

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ serie: string; plats: string }> };

export default async function DoorLinkPage({ params }: Params) {
  const { serie, plats } = await params;
  const supabase = await createClient();

  // Samma aliashantering som seriesidan: gamla serienycklar sitter på
  // utskrivna koder och får inte dö. Se lib/listings/series-aliases.ts.
  const kanonisk = canonicalSeriesSlug(serie);
  const occurrences = await hamtaKvallar(supabase, kanonisk, serie);
  if (occurrences.length === 0) notFound();

  const kvall = pickOccurrence(occurrences, stockholmToday());
  // Serien har tagit slut, eller allt som återstår är inställt. Seriesidan
  // säger det bättre än en 404 gör.
  if (!kvall) redirect(`/series/${kanonisk}`);

  const { data: typer } = await supabase
    .from("ticket_types")
    .select("id, name, sort_order, capacity, tickets_sold")
    .eq("listing_id", (kvall as DoorOccurrence & { id: string }).id)
    .order("sort_order", { ascending: true });

  const vald = pickTicketType((typer as DoorTicketType[] | null) ?? [], plats);
  redirect(doorTarget(kvall.slug, vald?.id ?? null));
}

async function hamtaKvallar(
  supabase: Awaited<ReturnType<typeof createClient>>,
  kanonisk: string,
  rå: string
): Promise<(DoorOccurrence & { id: string })[]> {
  const fraga = (slug: string) =>
    supabase
      .from("listings")
      .select("id, slug, title, event_date")
      .eq("series_slug", slug)
      .eq("is_active", true)
      .eq("is_public", true)
      .order("event_date", { ascending: true });

  const { data } = await fraga(kanonisk);
  const rader = (data as (DoorOccurrence & { id: string })[] | null) ?? [];
  if (rader.length > 0 || kanonisk === rå) return rader;
  const { data: fallback } = await fraga(rå);
  return (fallback as (DoorOccurrence & { id: string })[] | null) ?? [];
}
