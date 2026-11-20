/**
 * Kortkassan (Stripe Checkout) öppnas i appen i en webbläsarflik, eftersom
 * Google Pay inte finns i en inbäddad webbvy. Fliken är Chrome, inte appen —
 * så när Stripe skickar tillbaka köparen måste vägen gå via /till-appen, som
 * lämnar över till appen med usha:// och stänger fliken.
 *
 * Skalet märker sin user agent med UshaPlatformApp (capacitor.config.ts), så
 * servern vet att köpet startades i appen. Webben påverkas inte.
 */
export const NATIVE_UA_MARKER = "UshaPlatformApp";

export function isNativeAppRequest(req: Request): boolean {
  return (req.headers.get("user-agent") ?? "").includes(NATIVE_UA_MARKER);
}

/** https://usha.se/app/tickets?x=1 → https://usha.se/till-appen?till=%2Fapp%2Ftickets%3Fx%3D1 */
export function viaAppReturn(url: string, native: boolean): string {
  if (!native) return url;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url;
  }
  // Stripe ersätter bara den bokstavliga platshållaren, inte en kodad variant.
  const till = encodeURIComponent(`${u.pathname}${u.search}${u.hash}`).replace(
    /%7BCHECKOUT_SESSION_ID%7D/g,
    "{CHECKOUT_SESSION_ID}",
  );
  return `${u.origin}/till-appen?till=${till}`;
}

/** Bara interna sökvägar får lämnas över till appen. */
export function safeAppReturnPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return "/app";
  return raw;
}
