import type { SupabaseClient } from "@supabase/supabase-js";

export type LinkedEvent = { title: string; slug: string | null };

/** Kvällarna som uppdragen hänger på, uppslagna på listing-id. Publika evenemang, så tittarens klient räcker. */
export async function loadLinkedEvents(
  supabase: SupabaseClient,
  gigs: ReadonlyArray<{ listing_id?: string | null }>
): Promise<Record<string, LinkedEvent>> {
  const ids = Array.from(new Set(gigs.map((g) => g.listing_id).filter((id): id is string => !!id)));
  if (ids.length === 0) return {};
  const { data } = await supabase.from("listings").select("id, title, slug").in("id", ids);
  return Object.fromEntries((data ?? []).map((l) => [l.id, { title: l.title, slug: l.slug ?? null }]));
}
