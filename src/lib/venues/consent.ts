/**
 * Samtycke till att höra från lokalen.
 *
 * Konstruktionens poäng: deltagaren säger ja till en namngiven lokal, hos oss,
 * och vi levererar utskicket. Lokalen får aldrig uppgifterna utlämnade. Det är
 * det som gör att en samarbetspartner kan nå publiken utan att plattformen
 * lämnar ifrån sig personuppgifter.
 */

export interface ConsentBooking {
  customer_id: string | null;
  guest_email: string | null;
}

export type ConsentIdentity =
  | { profileId: string; email: null }
  | { profileId: null; email: string };

/**
 * Vem är det som samtycker?
 *
 * Kontot går före mejladressen. En gäst som senare skaffar konto med samma
 * adress skulle annars kunna få två rader som säger olika saker, och då finns
 * inget svar på frågan om personen sagt ja eller nej.
 *
 * Gäster har inget konto men köper biljetter, och deras samtycke är precis lika
 * giltigt — då är mejladressen identiteten.
 */
export function consentIdentity(booking: ConsentBooking): ConsentIdentity | null {
  if (booking.customer_id) return { profileId: booking.customer_id, email: null };

  const email = booking.guest_email?.trim().toLowerCase();
  if (email) return { profileId: null, email };

  // Varken konto eller mejl: ingen att fråga, och ingen att skicka till.
  return null;
}

export interface ConsentRow {
  granted_at: string | null;
  withdrawn_at: string | null;
}

export type ConsentState = "granted" | "withdrawn" | "unanswered";

/**
 * Vad gäller just nu?
 *
 * Återkallelsen väger alltid tyngst. Raden behålls efter ett nej — dels för att
 * kunna visa att personen faktiskt svarat, dels för att inte fråga om och om
 * igen någon som redan tackat nej.
 */
export function consentState(row: ConsentRow | null | undefined): ConsentState {
  if (!row) return "unanswered";
  if (row.withdrawn_at) return "withdrawn";
  if (row.granted_at) return "granted";
  return "unanswered";
}

/**
 * Ska frågan ställas på biljettsidan?
 *
 * Bara när det finns en BEKRÄFTAD lokal att fråga för. En obekräftad koppling
 * ger ingen rätt att samla samtycke i lokalens namn.
 *
 * Den som redan svarat får inte frågan igen — men ser sitt svar och kan ändra
 * det. Att ge och att ångra ska vara lika lätt, och det blir det bara om båda
 * finns på samma sida.
 */
export function shouldAskConsent(args: {
  venueProfileId: string | null | undefined;
  venueConfirmedAt: string | null | undefined;
  identity: ConsentIdentity | null;
}): boolean {
  return !!args.venueProfileId && !!args.venueConfirmedAt && !!args.identity;
}
