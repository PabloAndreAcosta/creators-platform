/**
 * Tvåspråkiga beskrivningar.
 *
 * Arrangörer skriver ofta hela texten två gånger i samma fält, med en rad som
 * "— English —" emellan. På sidan blir det dubbelt så lång text där hälften är
 * obegriplig för läsaren, och den som vill ha den andra halvan får scrolla
 * förbi en text hen redan läst.
 *
 * Vi delar på separatorraden och låter andra halvan ligga i en utfällning.
 * Ingenting tas bort — allt finns kvar, ett klick bort.
 */

const SEPARATOR =
  /^[\s\-–—_*=]*(english|engelska|svenska|swedish|español|espanol|spanska|spanish)[\s\-–—_*=:]*$/i;

/** Rubrik på utfällningen, på det språk den innehåller. */
const LABELS: Record<string, string> = {
  english: "English below",
  engelska: "English below",
  svenska: "Svenska nedan",
  swedish: "Svenska nedan",
  español: "Español abajo",
  espanol: "Español abajo",
  spanska: "Español abajo",
  spanish: "Español abajo",
};

export type SplitDescription = {
  /** Texten före separatorn — alltid synlig. */
  primary: string;
  /** Texten efter separatorn, eller null när ingen separator finns. */
  secondary: string | null;
  /** Rubrik för utfällningen, t.ex. "English below". */
  secondaryLabel: string | null;
};

export function splitBilingualDescription(text: string | null): SplitDescription {
  if (!text) return { primary: "", secondary: null, secondaryLabel: null };

  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const träff = lines[i].trim().match(SEPARATOR);
    if (!träff) continue;

    const primary = lines.slice(0, i).join("\n").trim();
    const secondary = lines.slice(i + 1).join("\n").trim();
    // En separator utan text på någon sida är bara en rubrik, inte en
    // språkdelning — då rör vi ingenting.
    if (!primary || !secondary) break;

    return {
      primary,
      secondary,
      secondaryLabel: LABELS[träff[1].toLowerCase()] ?? träff[1],
    };
  }

  return { primary: text, secondary: null, secondaryLabel: null };
}
