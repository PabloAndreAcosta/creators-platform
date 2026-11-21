import { stringFromBase64URL } from "@supabase/ssr";

const BASE64_PREFIX = "base64-";
// Samma tak som @supabase/ssr:s combineChunks går i praktiken aldrig över,
// men en spärr hindrar en ändlös loop om någon skickar hundratals chunkar.
const MAX_CHUNKS = 20;

/** Sessionens cookie-namn, med eller utan chunk-suffix (".0", ".1", …). */
export function isSessionCookieName(name: string, key: string): boolean {
  if (name === key) return true;
  if (!name.startsWith(`${key}.`)) return false;
  return /^\d+$/.test(name.slice(key.length + 1));
}

/**
 * Sätter ihop sessionscookien precis som @supabase/ssr gör (hel cookie först,
 * annars chunkar .0, .1, … tills en saknas) och avgör om resultatet är en
 * läsbar session.
 *
 * Varför: auth-js kör `JSON.parse` på värdet och lämnar tillbaka RÅSTRÄNGEN om
 * parsningen misslyckas. Sedan gör den `session.user = …` på strängen, vilket
 * kastar "Cannot create property 'user' on string" (sett på /app/tickets
 * 2026-11-20). Det händer när chunkarna inte hör ihop — en refresh har skrivit
 * nya chunkar men webbläsaren skickar en blandning av gamla och nya (eller en
 * host-only-kopia från före domänbytet skuggar en chunk), så den ihopsatta
 * JSON:en är trasig. En trasig session ska behandlas som ingen session: då
 * rensar middleware cookierna och användaren läker vid nästa sidladdning.
 *
 * Returnerar `true` när det inte finns någon sessionscookie alls (inget att
 * underkänna) eller när den går att läsa som ett sessionsobjekt.
 */
export function isSessionCookieReadable(
  get: (name: string) => string | undefined,
  key: string
): boolean {
  let combined = get(key);
  if (!combined) {
    const parts: string[] = [];
    for (let i = 0; i < MAX_CHUNKS; i += 1) {
      const chunk = get(`${key}.${i}`);
      if (!chunk) break;
      parts.push(chunk);
    }
    if (parts.length === 0) return true;
    combined = parts.join("");
  }

  let decoded = combined;
  if (combined.startsWith(BASE64_PREFIX)) {
    try {
      decoded = stringFromBase64URL(combined.slice(BASE64_PREFIX.length));
    } catch {
      return false;
    }
  }

  try {
    const parsed: unknown = JSON.parse(decoded);
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed) &&
      typeof (parsed as { access_token?: unknown }).access_token === "string"
    );
  } catch {
    return false;
  }
}

/**
 * Lindar en cookie-läsare så att alla sessionens cookies (hel + chunkar)
 * läses som saknade när den ihopsatta sessionen är trasig. Andra cookies —
 * t.ex. PKCE-verifieraren `<key>-code-verifier` — passerar orörda.
 * Kontrollen görs en gång per läsare, inte per chunk.
 */
export function guardSessionCookies(
  get: (name: string) => string | undefined,
  key: string
): (name: string) => string | undefined {
  let readable: boolean | undefined;
  return (name: string) => {
    if (isSessionCookieName(name, key)) {
      if (readable === undefined) readable = isSessionCookieReadable(get, key);
      if (!readable) return undefined;
    }
    return get(name);
  };
}
