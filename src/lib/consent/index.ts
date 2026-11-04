// Samtycke till statistikcookies (Google Analytics).
//
// Svensk lag (LEK 9 kap. 28 §) kräver samtycke för cookies som inte är
// nödvändiga, och statistik räknas inte som nödvändigt. Därför:
//  - Google Analytics startar alltid i samtyckesläge med allt NEKAT. Inga
//    statistikcookies sätts innan besökaren valt.
//  - "Godkänn statistik" slår på analytics_storage. "Bara nödvändiga" lämnar
//    det nekat; GA4 får då bara cookiefria, anonyma signaler.
//  - Reklam (ad_storage m.fl.) är alltid nekat. Usha kör ingen reklam.
//  - Valet sparas i en egen cookie, som räknas som nödvändig (den minns bara
//    valet). Den går att ändra via länken Cookieinställningar.

export const CONSENT_COOKIE = "usha_consent";
/** Sex månader, sedan frågar vi igen. */
export const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 182;
/** Länken Cookieinställningar skickar den här händelsen för att öppna bannern igen. */
export const OPEN_CONSENT_EVENT = "usha:open-consent";

export type ConsentChoice = "granted" | "denied";

/** Läser valet ur en cookie-sträng. null = inget val gjort än. */
export function readConsent(cookieString: string): ConsentChoice | null {
  const match = cookieString.match(/(?:^|;\s*)usha_consent=(granted|denied)(?:;|$)/);
  return match ? (match[1] as ConsentChoice) : null;
}

/** Cookie-strängen som sparar valet. */
export function consentCookie(choice: ConsentChoice, secure = true): string {
  return `${CONSENT_COOKIE}=${choice}; Max-Age=${CONSENT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure ? "; Secure" : ""}`;
}

/** Standardläget som GA ska starta i, före allt annat. */
export const CONSENT_DEFAULTS = {
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
  analytics_storage: "denied",
} as const;

/** Sparar valet och säger till Google Analytics direkt, utan omladdning. */
export function saveConsent(choice: ConsentChoice): void {
  if (typeof document === "undefined") return;
  document.cookie = consentCookie(choice, location.protocol === "https:");
  window.gtag?.("consent", "update", { analytics_storage: choice });
}
