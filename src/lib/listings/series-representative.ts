import { isCancelled } from "@/lib/entrance/door-link";

/**
 * Kvällen som får tala för hela serien: rubrik, text och bild på seriesidan.
 *
 * Den första kvällen duger inte. The Lab Torsdag inleddes med en inställd
 * premiär, och då stod hela serien som "INSTÄLLT" — även i JSON-LD:n, som
 * Google läser — trots att alla kommande kvällar blev av.
 *
 * Ordningen:
 *   1. den SISTA kommande kvällen som inte är inställd. Engångsavvikelser
 *      (en inställd kväll, en open session en festivalhelg) gäller nästan alltid
 *      de närmaste datumen; den bortersta kvällen beskriver det som gäller.
 *   2. den senaste passerade kvällen som inte var inställd — en avslutad serie
 *      visas som den faktiskt var.
 *   3. den första, om allt är inställt.
 *
 * Listan förutsätts sorterad på datum stigande. `idag` jämförs som datum.
 */
export function seriesRepresentative<T extends { title: string; event_date: string | null }>(
  occurrences: readonly T[],
  idag: string
): T | undefined {
  const live = occurrences.filter((o) => !isCancelled(o.title));
  const upcoming = live.filter((o) => !o.event_date || o.event_date.slice(0, 10) >= idag);
  return upcoming.at(-1) ?? live.at(-1) ?? occurrences[0];
}
