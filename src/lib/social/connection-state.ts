// Härleder vilket tillstånd en social koppling faktiskt är i.
//
// Tidigare var kopplingar binära: token finns = "ansluten". Ett utgånget token
// ser likadant ut som ett färskt i databasen, så UI:t visade grönt ända tills
// användaren råkade klicka på "Hämta media" och fick ett fel. Här skiljer vi på
// levande, snart utgången och död så att sidan kan säga sanningen.

export type ConnectionStatus =
  | "connected"
  | "expiring_soon"
  | "expired"
  | "disconnected";

/** Så många dagar före utgång vi börjar be användaren koppla om. */
export const EXPIRY_WARNING_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface ConnectionInput {
  /** Har vi ett access token lagrat överhuvudtaget? */
  hasToken: boolean;
  /**
   * När tokenet slutar gälla. NULL betyder "ingen känd utgång" — inte utgången.
   * Facebooks sidtokens från ett long-lived användartoken dör aldrig, och för
   * dem är NULL det korrekta värdet.
   */
  expiresAt: string | Date | null;
}

export interface ConnectionState {
  status: ConnectionStatus;
  /** Hela dagar kvar till utgång. null när utgång saknas eller redan passerat. */
  daysLeft: number | null;
  /** true när användaren behöver göra något åt kopplingen. */
  needsAction: boolean;
}

export function getConnectionState(
  { hasToken, expiresAt }: ConnectionInput,
  now: Date = new Date()
): ConnectionState {
  if (!hasToken) {
    return { status: "disconnected", daysLeft: null, needsAction: false };
  }

  if (expiresAt == null) {
    return { status: "connected", daysLeft: null, needsAction: false };
  }

  const expiry = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);

  // Ett ogiltigt datum får aldrig tolkas som "giltigt för alltid" — då är vi
  // tillbaka i den gröna badgen som ljuger. Be hellre om en omkoppling.
  if (Number.isNaN(expiry.getTime())) {
    return { status: "expired", daysLeft: null, needsAction: true };
  }

  const msLeft = expiry.getTime() - now.getTime();

  if (msLeft <= 0) {
    return { status: "expired", daysLeft: null, needsAction: true };
  }

  const daysLeft = Math.floor(msLeft / MS_PER_DAY);

  if (daysLeft < EXPIRY_WARNING_DAYS) {
    return { status: "expiring_soon", daysLeft, needsAction: true };
  }

  return { status: "connected", daysLeft, needsAction: false };
}

/**
 * Utgångstidpunkt ur ett OAuth-svars `expires_in` (sekunder). Providers är
 * inkonsekventa: vissa utelämnar fältet, vissa skickar det som sträng.
 */
export function expiryFromExpiresIn(
  expiresIn: unknown,
  now: Date = new Date()
): string | null {
  const seconds =
    typeof expiresIn === "number"
      ? expiresIn
      : typeof expiresIn === "string"
        ? Number(expiresIn)
        : NaN;

  if (!Number.isFinite(seconds) || seconds <= 0) return null;

  return new Date(now.getTime() + seconds * 1000).toISOString();
}
