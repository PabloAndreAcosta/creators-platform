/**
 * Instruktörer: kreatörer som erbjuder lektioner, coachning eller PT
 * (profiles.offers_coaching). Titeln är fri — förslagen finns bara för att
 * de vanliga ska ligga nära till hands.
 */

export const COACHING_TITLE_MAX = 40;
export const COACHING_TITLE_PRESETS = ["instructor", "coach", "pt", "teacher"] as const;

export const COACHING_FORMATS = ["in_person", "online"] as const;
export type CoachingFormat = (typeof COACHING_FORMATS)[number];

export function parseCoachingTitle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const title = value.replace(/\s+/g, " ").trim().slice(0, COACHING_TITLE_MAX).trim();
  return title || null;
}

export const COACHING_CREDENTIALS_MAX = 10;
const CREDENTIAL_MAX_LENGTH = 120;

/** Meriter: frivilliga rader som "Certifierad PT, GIH 2019" eller "Ansvarsförsäkring". */
export function parseCoachingCredentials(value: unknown): string[] {
  const list = Array.isArray(value) ? value : [];
  const out: string[] = [];
  for (const v of list) {
    if (typeof v !== "string") continue;
    const line = v.replace(/\s+/g, " ").trim().slice(0, CREDENTIAL_MAX_LENGTH).trim();
    if (line && !out.includes(line)) out.push(line);
    if (out.length >= COACHING_CREDENTIALS_MAX) break;
  }
  return out;
}

export function parseCoachingFormats(value: unknown): CoachingFormat[] {
  const list = Array.isArray(value) ? value : [];
  return COACHING_FORMATS.filter((f) => list.includes(f));
}

export interface InstructorRow {
  id: string;
  slug: string | null;
  full_name: string | null;
  avatar_url: string | null;
  coaching_title: string | null;
  coaching_bio: string | null;
  coaching_hourly_rate_sek: number | null;
  coaching_specialties: string[] | null;
  coaching_formats: string[] | null;
  coaching_credentials?: string[] | null;
  dance_styles: string[] | null;
  dance_languages: string[] | null;
  locations: string[] | null;
  location: string | null;
}

export interface InstructorFilter {
  q?: string;
  city?: string;
  language?: string;
  format?: CoachingFormat | "";
  maxRate?: number | null;
}

const norm = (s: string) => s.toLocaleLowerCase("sv-SE").trim();
const anyIncludes = (list: (string | null | undefined)[], needle: string) =>
  list.some((v) => !!v && norm(v).includes(needle));

/** Allt man kan söka på: titel, inriktning, stilar och presentation. */
export function matchesInstructor(row: InstructorRow, f: InstructorFilter): boolean {
  if (f.q) {
    const q = norm(f.q);
    const hay = [row.full_name, row.coaching_title, row.coaching_bio, ...(row.coaching_specialties ?? []), ...(row.dance_styles ?? [])];
    if (!anyIncludes(hay, q)) return false;
  }
  if (f.city) {
    if (!anyIncludes([...(row.locations ?? []), row.location], norm(f.city))) return false;
  }
  if (f.language) {
    if (!anyIncludes(row.dance_languages ?? [], norm(f.language))) return false;
  }
  // Den som inte angett format visas för båda — hellre en träff för mycket.
  if (f.format && row.coaching_formats?.length && !row.coaching_formats.includes(f.format)) return false;
  if (f.maxRate != null && row.coaching_hourly_rate_sek != null && row.coaching_hourly_rate_sek > f.maxRate) return false;
  return true;
}

export function instructorHref(row: Pick<InstructorRow, "id" | "slug">): string {
  return `/creators/${row.slug || row.id}`;
}
