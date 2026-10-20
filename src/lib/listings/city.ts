/**
 * Orten ur en skriven adress.
 *
 * `event_city` fylls i av platsväljaren (Google Places), men bara när värden
 * faktiskt använder den. Skrivs adressen för hand blir kolumnen tom, och då
 * försvinner kvällen från /upplevelser/<stad> — sidan filtrerar på staden,
 * inte på adressen, eftersom adressen inleds med lokalens namn
 * ("Bacchi Syre, Järntorgsgatan 5, ...") och ett namn aldrig är en ort.
 *
 * Den här funktionen räddar de fallen genom att leta efter det svenska
 * postnumret: fem siffror, med eller utan mellanslag, följt av orten.
 * "Järfälla Kampsport Klubb, Fänriksvägen 1, 177 43 Järfälla, Sverige"
 * ger alltså Järfälla.
 *
 * Hittas inget postnummer returneras null. Att gissa på sista ledet vore
 * värre än att låta bli: "Gamla stan" är en stadsdel, inte en ort, och en
 * felaktig stad ger en stadssida som inte motsvarar någonting.
 */

const LANDSLED = new Set(["sverige", "sweden"]);

/** Postnummer + ort: "177 43 Järfälla" eller "17743 Järfälla". */
const POSTNUMMER_ORT = /\b\d{3}\s?\d{2}\s+([^,]+)/;

export function cityFromAddress(address: string | null | undefined): string | null {
  if (!address) return null;

  const trimmad = address.trim();
  if (!trimmad) return null;

  const trff = POSTNUMMER_ORT.exec(trimmad);
  if (!trff) return null;

  const ort = trff[1].trim();
  if (!ort) return null;

  // "177 43 Sverige" vore en adress utan ort — landet är inte en stad.
  if (LANDSLED.has(ort.toLowerCase())) return null;

  // Ett ortnamn är ett till några få ord. Fastnar vi i en mening är det inte
  // en ort vi hittat, och då är null ärligare.
  if (ort.split(/\s+/).length > 4) return null;

  return ort;
}

/**
 * Stad att spara på en listning: det värden valt om det finns, annars den
 * som går att läsa ut ur adressen.
 */
export function resolveEventCity(
  city: string | null | undefined,
  address: string | null | undefined
): string | null {
  const vald = city?.trim();
  if (vald) return vald;
  return cityFromAddress(address);
}
