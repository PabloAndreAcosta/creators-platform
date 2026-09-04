/**
 * Vägen tillbaka efter inloggning eller registrering.
 *
 * Login- och signup-sidorna läser parametern `next`. Tre knappar i appen
 * skickade `redirect` i stället — följ-knappen på en profil, gilla i flödet och
 * köp direkt ur flödet — så den som klickade hamnade på /app och fick själv
 * hitta tillbaka. För en lokal är det knappen som räknas: den som skannar en
 * QR-kod i baren, trycker Följ och skapar konto ska landa på lokalens sida
 * igen, inte i en tom app.
 *
 * Dessutom tappade login-sidans "skapa konto" och signup-sidans "logga in"
 * bort vägen tillbaka när man bytte mellan dem.
 */

/** Bara interna vägar. "//example.com" är en extern adress, inte en rutt. */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : null;
}

/** Bygger t.ex. /login?next=%2Fcreators%2Fabc. Utan väg: bara /login. */
export function authUrlWithNext(base: "/login" | "/signup", next: string | null | undefined): string {
  const safe = safeNextPath(next);
  return safe ? `${base}?next=${encodeURIComponent(safe)}` : base;
}

/**
 * OAuth-återvändoadressen. Google- och Facebook-inloggningen skickade alltid
 * till /callback utan väg tillbaka, så den som skannade en QR-kod och valde
 * "Fortsätt med Google" landade i appen i stället för på sidan hen kom från.
 * /callback läser `next` och validerar den på nytt på servern.
 */
export function callbackUrlWithNext(origin: string, next: string | null | undefined): string {
  const safe = safeNextPath(next);
  return safe ? `${origin}/callback?next=${encodeURIComponent(safe)}` : `${origin}/callback`;
}
