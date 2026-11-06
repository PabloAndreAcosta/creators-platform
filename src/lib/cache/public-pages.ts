/**
 * Edge-cache för utloggade besökare.
 *
 * Varje sida på usha.se renderas på nytt för varje besök, eftersom
 * inloggningen rör cookies på varje anrop och Next därför märker allt
 * `private, no-store`. För en utloggad besökare är de publika sidorna
 * ändå identiska — det enda som skiljer är språk och tema. Så här avgörs om
 * ett anrop får svaras ur Vercels CDN-cache, och hur cache-nyckeln byggs.
 *
 * Principen: cacha BARA när svaret bevisligen är lika för alla.
 *   - Ingen auth-cookie: ingen användare, inga "mina" tillstånd på sidan.
 *   - Inget tema valt: standardtemat renderas.
 *   - Inga parametrar som sätter cookies (?ref, ?utm_*, ?lang): ett svar med
 *     Set-Cookie cachas aldrig av Vercel, så det vore bara förvirrande.
 *   - Språket läggs i nyckeln (`_anon=sv`) i stället för att variera på
 *     Accept-Language, som har hundratals varianter och skulle ge få träffar.
 *
 * En inloggad besökare begär samma URL utan `_anon` och når aldrig den
 * cachade posten: den nyckeln finns bara för omskrivna, anonyma anrop.
 * Spårningsparametrar från Facebook/Instagram (fbclid m.fl.) tas bort ur
 * nyckeln, annars blir varje klick från en story en egen miss.
 */
import { isSupabaseAuthCookie } from "@/lib/supabase/auth-cookies";

/** Query-parametern som skiljer den anonyma, cachebara varianten från den vanliga. */
export const ANON_PARAM = "_anon";

/** Sidor som är lika för alla utloggade. Eventsidor är det inte (klipp, följ, köpta biljetter). */
export const CACHEABLE_PATHS: ReadonlySet<string> = new Set([
  "/",
  "/upplevelser",
  "/kalender",
  "/instruktorer",
  "/taxidansare",
  "/for-kreatorer",
  "/for-platser",
  "/for-publik",
  "/om",
  "/platser",
  "/guide",
]);

/** Parametrar som sidorna inte läser men som gör varje länk unik. */
const TRACKING_PARAMS = ["fbclid", "gclid", "gbraid", "wbraid", "igshid", "mc_cid", "mc_eid", "ttclid", "msclkid"];

/** Parametrar som får middleware att sätta en cookie — svaret blir då ocachebart ändå. */
const COOKIE_SETTING_PARAMS = ["ref", "lang"];

/** 60 s färskt, sedan serveras gammalt i upp till 10 min medan en ny render hämtas i bakgrunden. */
export const CDN_CACHE_CONTROL = "s-maxage=60, stale-while-revalidate=600";

export interface CacheInput {
  method: string;
  pathname: string;
  searchParams: URLSearchParams;
  cookieNames: string[];
  /** Språket middleware redan löst ut (url → cookie → Accept-Language). */
  locale: string;
}

export type CacheDecision =
  | { cacheable: true; locale: string }
  | { cacheable: false; reason: string };

export function decidePublicCache(input: CacheInput): CacheDecision {
  if (input.method !== "GET") return { cacheable: false, reason: "method" };
  if (!CACHEABLE_PATHS.has(input.pathname)) return { cacheable: false, reason: "path" };
  if (input.cookieNames.some(isSupabaseAuthCookie)) return { cacheable: false, reason: "auth" };
  if (input.cookieNames.includes("usha-theme")) return { cacheable: false, reason: "theme" };
  for (const key of input.searchParams.keys()) {
    if (COOKIE_SETTING_PARAMS.includes(key) || key.startsWith("utm_")) {
      return { cacheable: false, reason: `param:${key}` };
    }
  }
  return { cacheable: true, locale: input.locale };
}

/**
 * URL:en anropet skrivs om till: samma sida, utan spårningsparametrar, med
 * språket som del av nyckeln. Parametrarna sorteras så att `?a=1&b=2` och
 * `?b=2&a=1` blir samma post.
 */
export function anonymousCacheUrl(url: URL, locale: string): URL {
  const out = new URL(url.toString());
  for (const p of TRACKING_PARAMS) out.searchParams.delete(p);
  out.searchParams.delete(ANON_PARAM);
  out.searchParams.set(ANON_PARAM, locale);
  out.searchParams.sort();
  return out;
}

/** Tar bort `_anon` ur en inkommande adress så att ingen kan begära den cachade varianten direkt. */
export function stripAnonParam(url: URL): URL | null {
  if (!url.searchParams.has(ANON_PARAM)) return null;
  const out = new URL(url.toString());
  out.searchParams.delete(ANON_PARAM);
  return out;
}
