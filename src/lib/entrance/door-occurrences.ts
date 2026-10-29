import type { createClient } from "@/lib/supabase/server";
import type { DoorOccurrence } from "@/lib/entrance/door-link";

/**
 * Seriens aktiva, publika kvällar i datumordning. Faller tillbaka på den råa
 * serienyckeln när aliaset inte ger något — gamla nycklar sitter på utskrivna
 * koder och får inte dö (se lib/listings/series-aliases.ts).
 */
export async function hamtaKvallar(
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

export interface DoorScreenTicket {
  id: string;
  name: string;
  price: number;
  sort_order: number | null;
}

/**
 * Vad dörrlänken för en biljettyp ska heta. Sorteringsnumret när det är unikt
 * för kvällen — då spelar namnet ingen roll och koden överlever att typen döps
 * om. Annars namnet, som dörrlänken matchar på början av.
 */
export function platsFor(t: DoorScreenTicket, alla: readonly DoorScreenTicket[]): string {
  const sammaNummer = alla.filter((x) => (x.sort_order ?? 0) === (t.sort_order ?? 0)).length;
  return sammaNummer === 1 ? String(t.sort_order ?? 0) : encodeURIComponent(t.name);
}
