/**
 * Slå ihop flera källor till en lista utan dubbletter.
 *
 * Finns för att samma sak nu kan nås på två vägar. Ett evenemang hos en lokal
 * hör både till arrangören och till lokalen, så snart något slår ihop "det jag
 * följer" från båda hållen får den som följer BÅDA se samma sak två gånger.
 *
 * Det syns redan i notisjobbet, där följaren annars fått två identiska mejl om
 * samma kväll. Flödet har i dag en enda fråga mot listings och kan därför inte
 * dubblera — men den dagen det blir "evenemang hos lokaler du följer" är det
 * exakt samma fälla, och då ska verktyget finnas och vara testat.
 *
 * Ordningen bevaras och första förekomsten vinner: den källa som anses viktigast
 * skickas först, och det är dess placering som gäller.
 */
export function dedupeBy<T>(sources: readonly (readonly T[])[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];

  for (const source of sources) {
    for (const item of source) {
      const k = key(item);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(item);
    }
  }

  return out;
}
