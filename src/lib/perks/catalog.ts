/**
 * Förmånerna: upplevelser som leverantörer ger Usha-kunder gratis eller till
 * förmånspris.
 *
 * VARFÖR EN LISTA I KODEN OCH INGEN TABELL: ingen leverantör har sagt ja än
 * (2026-11-25). En egen tabell vore en migration för noll rader. Själva
 * inlösen finns redan: varje förmån pekar på en rad i `series_access_codes`
 * på leverantörens serie — gratis när `discount_price` är NULL, annars
 * förmånspriset i kr — och bokas med samma kodflöde som alla andra koder.
 * Behöver leverantörerna en egen vy för att lägga upp förmåner blir det en
 * tabell då, med den här typen som förlaga.
 *
 * KODEN STÅR INTE HÄR. Repot är publikt. En förmån pekar på kodradens id;
 * själva koden läses på servern, och visas bara för den som
 * `isPerkEligible` släpper igenom.
 *
 * RAMAR för vad som får stå här (juristens underlag 2026-11-24): bara
 * upplevelser på plats hos leverantören. Inga hotellnätter, resor eller paket
 * av resa + boende (paketreselagen). Kategorierna nedan är därför stängda.
 */
import type { Locale } from "@/i18n/config";

export const PERK_CATEGORIES = [
  "sauna",
  "climbing",
  "ceramics",
  "cooking",
  "dance",
  "wellness",
  "other",
] as const;
export type PerkCategory = (typeof PERK_CATEGORIES)[number];

/** Text från leverantören. Svenska krävs; saknas ett språk visas svenskan. */
export type LocalizedText = { sv: string } & Partial<Record<Exclude<Locale, "sv">, string>>;

export interface Perk {
  /** Stabilt id, gemener och bindestreck. Används som nyckel i listan. */
  id: string;
  /** Leverantörens namn som det ska visas. */
  provider: string;
  city: string;
  category: PerkCategory;
  title: LocalizedText;
  description: LocalizedText;
  /** Villkor i klartext: antal platser, vilka dagar, ålder osv. */
  terms?: LocalizedText;
  /** Leverantörens serie på Usha, där koden löses in. */
  seriesSlug: string;
  /** id på raden i series_access_codes. Aldrig själva koden. */
  accessCodeId: string;
  /** Sista dag förmånen visas, ÅÅÅÅ-MM-DD (svensk tid). Utan = tills vidare. */
  validUntil?: string;
}

/**
 * Alla förmåner. Tom tills den första leverantören sagt ja — sidorna visar då
 * ett tomt läge med förklaring, de göms inte.
 */
export const PERKS: readonly Perk[] = [];

export function pickText(text: LocalizedText, locale: string): string {
  const v = (text as Record<string, string | undefined>)[locale];
  return v && v.trim() ? v : text.sv;
}

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Felen i en förmånslista, i klartext. Tom lista = giltig. Körs i testet. */
export function validatePerks(perks: readonly Perk[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const p of perks) {
    const at = p.id || "(utan id)";
    if (!ID_RE.test(p.id)) errors.push(`${at}: id ska vara gemener och bindestreck`);
    if (seen.has(p.id)) errors.push(`${at}: id finns redan`);
    seen.add(p.id);
    if (!p.provider.trim()) errors.push(`${at}: leverantör saknas`);
    if (!p.city.trim()) errors.push(`${at}: stad saknas`);
    if (!PERK_CATEGORIES.includes(p.category)) errors.push(`${at}: okänd kategori ${p.category}`);
    if (!p.title.sv.trim()) errors.push(`${at}: svensk rubrik saknas`);
    if (!p.description.sv.trim()) errors.push(`${at}: svensk beskrivning saknas`);
    if (!p.seriesSlug.trim()) errors.push(`${at}: serie saknas`);
    if (!UUID_RE.test(p.accessCodeId)) errors.push(`${at}: accessCodeId ska vara kodradens uuid, inte koden`);
    if (p.validUntil !== undefined && !DATE_RE.test(p.validUntil)) errors.push(`${at}: validUntil ska vara ÅÅÅÅ-MM-DD`);
  }
  return errors;
}
