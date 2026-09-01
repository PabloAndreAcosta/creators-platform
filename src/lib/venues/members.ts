import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Lokalteam: vem som tillhör en lokal och vad de får göra.
 *
 * Formen speglar `adminAccessFor` med flit. Plattformen har redan en modell för
 * delegerad behörighet — uppräknad lista, check-spärr i databasen, och en nivå
 * som inte går att dela ut — och den som läser koden ska bara behöva förstå den
 * idén en gång.
 */

/**
 * Bitarna en lokal kan delas ut i.
 *
 * Hålls i takt med check-villkoret på `venue_members.capabilities`. Att lägga
 * till en sjunde är en migration med flit, så att ett nytt verktyg inte tyst
 * vidgar vad en inbjuden person kommer åt.
 *
 * Här finns INGEN behörighet för pengar, och det är ingen glömska: den som ska
 * hantera ekonomin är ägaren. Ska någon annan sköta den byter man ägare, inte
 * behörighet.
 */
export const VENUE_CAPABILITIES = [
  "events",   // skapa och ändra lokalens evenemang
  "bookings", // se bokningar och gästlistor
  "scan",     // checka in gäster i dörren
  "messages", // skicka utskick till följare och deltagare
  "stats",    // se statistik och exportera underlag
  "page",     // redigera lokalens sida, svara på kopplingsförfrågningar
] as const;

export type VenueCapability = (typeof VENUE_CAPABILITIES)[number];

export function isVenueCapability(value: unknown): value is VenueCapability {
  return typeof value === "string" && (VENUE_CAPABILITIES as readonly string[]).includes(value);
}

/**
 * Förval. Sex kryssrutor är rätt modell men fel gränssnitt — ägaren väljer ett
 * knippe och justerar vid behov. Förvalen är bara namn på uppsättningar av
 * samma behörigheter, ingen egen mekanism, så de kan ändras fritt utan att
 * något annat påverkas.
 */
export const VENUE_PRESETS: Record<string, readonly VenueCapability[]> = {
  co_host: ["events", "bookings", "messages", "stats", "page"],
  door: ["scan", "bookings"],
  marketing: ["messages", "page", "stats"],
};

export interface VenueAccess {
  /** Lokalens eget konto. Håller allt, och är den enda som kan dela ut. */
  owner: boolean;
  /** Vad personen faktiskt får göra. Ägaren håller alla. */
  capabilities: VenueCapability[];
}

export const NO_VENUE_ACCESS: VenueAccess = { owner: false, capabilities: [] };

/**
 * Rensar en lista från klienten. Okända värden slängs i stället för att
 * avvisa hela anropet — men dubbletter tas bort, så en rad inte kan svälla.
 */
export function sanitizeCapabilities(input: unknown): VenueCapability[] {
  if (!Array.isArray(input)) return [];
  const out: VenueCapability[] = [];
  for (const v of input) {
    if (isVenueCapability(v) && !out.includes(v)) out.push(v);
  }
  return out;
}

/** Slår upp ett förval. Okänt namn ger tom lista, aldrig ett kastat fel. */
export function expandPreset(name: string): VenueCapability[] {
  return [...(VENUE_PRESETS[name] ?? [])];
}

/**
 * Har personen den här behörigheten på lokalen?
 *
 * Ägaren har allt utan att någon rad säger det — precis som en full admin
 * håller varje capability utan explicita grants.
 */
export function hasVenueCapability(access: VenueAccess, cap: VenueCapability): boolean {
  return access.owner || access.capabilities.includes(cap);
}

/**
 * Läser en persons åtkomst till en lokal.
 *
 * Går via service-role: `venue_members` är RLS-skyddad till ägaren och den
 * berörda medlemmen, och den här funktionen anropas i behörighetskontroller där
 * ett tomt svar av fel skäl skulle bli ett tyst nej. Uppslaget sker på id:n som
 * anroparen redan verifierat.
 */
export async function venueAccessFor(
  userId: string | null | undefined,
  venueProfileId: string | null | undefined
): Promise<VenueAccess> {
  if (!userId || !venueProfileId) return NO_VENUE_ACCESS;

  // Ägaren ÄR lokalen. Ingen rad behövs, och enligt check-villkoret får ingen
  // finnas — annars hade det funnits två svar på vem som bestämmer.
  if (userId === venueProfileId) {
    return { owner: true, capabilities: [...VENUE_CAPABILITIES] };
  }

  const { data } = await createAdminClient()
    .from("venue_members")
    .select("capabilities, accepted_at, removed_at")
    .eq("venue_profile_id", venueProfileId)
    .eq("user_id", userId)
    .maybeSingle();

  // Obesvarad inbjudan ger ingenting. Behörigheten börjar gälla när personen
  // sagt ja, inte när någon annan bestämt det åt hen.
  if (!data || !data.accepted_at || data.removed_at) return NO_VENUE_ACCESS;

  return { owner: false, capabilities: sanitizeCapabilities(data.capabilities) };
}

/** Lokalerna en person tillhör. En person kan tillhöra flera. */
export async function venuesForUser(userId: string): Promise<string[]> {
  const { data } = await createAdminClient()
    .from("venue_members")
    .select("venue_profile_id")
    .eq("user_id", userId)
    .not("accepted_at", "is", null)
    .is("removed_at", null);

  return (data ?? []).map((r: { venue_profile_id: string }) => r.venue_profile_id);
}

export interface CreatableVenue {
  id: string;
  name: string;
}

/**
 * Lokaler personen får skapa evenemang i namnet på.
 *
 * Bara lokaler där hen accepterat medlemskap OCH håller `events`. Ägarens egen
 * lokal ingår inte — den är hen redan, och "skapa som mig själv" är normalfallet
 * som inte behöver väljas.
 */
export async function venuesUserCanCreateFor(userId: string): Promise<CreatableVenue[]> {
  const admin = createAdminClient();

  const { data } = await admin
    .from("venue_members")
    .select("venue_profile_id, capabilities, profiles!venue_profile_id(full_name, company_name)")
    .eq("user_id", userId)
    .not("accepted_at", "is", null)
    .is("removed_at", null);

  const out: CreatableVenue[] = [];
  for (const row of data ?? []) {
    if (!sanitizeCapabilities(row.capabilities).includes("events")) continue;
    const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const name = (p?.company_name || p?.full_name || "").trim();
    if (name) out.push({ id: row.venue_profile_id, name });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, "sv"));
}
