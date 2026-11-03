import crypto from "crypto";

/**
 * Åldersbevis till Usha Games (ushagames.se).
 *
 * Spelen ligger på en egen domän och har inga konton. Den som vill in i
 * vuxenspelen legitimerar sig med BankID här på usha.se, och skickas tillbaka
 * med ett kortlivat, signerat bevis på att hen är över 18. Beviset bär ingen
 * identitet alls: inget namn, inget personnummer, ingen hash.
 *
 * Formatet är base64url(JSON) + "." + base64url(HMAC-SHA256), med den delade
 * hemligheten GAMES_AGE_SECRET. Spelservern (skuggspelet, src/server/age.ts)
 * verifierar det och byter det mot en egen cookie.
 */

/** Hur länge överlämningen gäller. Den används direkt när sidan laddas. */
export const GAMES_HANDOFF_SECONDS = 120;
export const GAMES_ORIGIN_DEFAULT = "https://ushagames.se";

export function gamesSecret(): string {
  return process.env.GAMES_AGE_SECRET ?? "";
}

export function gamesOrigin(): string {
  return (process.env.GAMES_ORIGIN || GAMES_ORIGIN_DEFAULT).replace(/\/$/, "");
}

const b64url = (buf: Buffer) => buf.toString("base64url");

export function signGamesHandoff(secret: string, nowSeconds = Math.floor(Date.now() / 1000)): string {
  const payload = b64url(Buffer.from(JSON.stringify({ p: "handoff", adult: true, exp: nowSeconds + GAMES_HANDOFF_SECONDS })));
  const sig = b64url(crypto.createHmac("sha256", secret).update(payload).digest());
  return `${payload}.${sig}`;
}

/**
 * Sökvägen spelaren ska tillbaka till på spelens domän. Bara appens egna sidor
 * (/spel/…) godtas, så att usha.se inte kan användas som öppen omdirigering.
 */
export function safeGamesReturn(value: unknown): string {
  const fallback = "/spel/?vuxen";
  if (typeof value !== "string" || value.length > 200) return fallback;
  if (!value.startsWith("/spel/") || value.includes("//") || value.includes("\\") || value.includes("#")) return fallback;
  return /^[\w\-./?=&%]*$/.test(value) ? value : fallback;
}

/** Adressen tillbaka. Beviset eller felet läggs i fragmentet, som aldrig når någon server eller logg. */
export function gamesReturnUrl(ret: string, fragment: { legitimering: string } | { fel: "under18" | "avbrutet" | "fel" }): string {
  const hash = "legitimering" in fragment ? `legitimering=${fragment.legitimering}` : `legitimering-fel=${fragment.fel}`;
  return `${gamesOrigin()}${safeGamesReturn(ret)}#${hash}`;
}
