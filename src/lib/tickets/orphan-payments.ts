/**
 * Betalningar utan biljett.
 *
 * Det värsta som kan hända i kassan är inte ett felmeddelande — det är tystnad.
 * Gästen betalar, pengarna landar hos Stripe, och webhooken som ska skapa
 * bokningen avbryter. Ingen biljett, inget mejl, ingen rad någonstans. Gästen
 * står i dörren med ett kvitto från Stripe och vi har inget att visa.
 *
 * Risken blev konkret när mejlfältet togs bort ur gästkassan (PR #438): sedan
 * dess hämtar webhooken adressen ur Stripes customer_details, och saknas den
 * helt avbryter den. Men felet är äldre än så och kan uppstå av vilket avbrott
 * som helst mitt i webhooken.
 *
 * Det här är den enda kontrollen som ser åt andra hållet: från pengarna till
 * biljetten, i stället för tvärtom. Allt annat vi mäter utgår från våra egna
 * rader, och en rad som aldrig skapades syns inte i dem.
 *
 * Ren modul utan I/O — den avgör vad som är ett larm, inte hur man hämtar det.
 */

export interface ChargeLike {
  id: string;
  created: number; // sekunder, Stripes format
  amount: number;
  status: string;
  refunded?: boolean;
  payment_intent?: string | null;
  metadata?: Record<string, string> | null;
}

/**
 * Hur länge en betalning får sakna bokning innan den räknas som föräldralös.
 *
 * Webhooken är inte synkron: Stripe kan behöva försöka igen, och vår sida kan
 * vara upptagen. Utan en mognadstid hade varje kontroll larmat om betalningar
 * som höll på att bli bokningar just då.
 *
 * Femton minuter är rikligt — en webhook som inte gått igenom på en kvart
 * kommer sällan igenom alls.
 */
export const MOGNAD_SEKUNDER = 15 * 60;

/**
 * Betalningar som SKA ha en bokning.
 *
 * `event_id` i metadatan är det som skiljer ett biljettköp från ett
 * abonnemang eller en produkt. Den stämplas av buildPaymentMetadata på varje
 * betalning som gäller en kväll. Saknas den är betalningen något annat, och
 * något annat ska inte larma här.
 */
export function orphanCandidates(charges: readonly ChargeLike[], now: Date): ChargeLike[] {
  const grans = Math.floor(now.getTime() / 1000) - MOGNAD_SEKUNDER;
  return charges.filter(
    (c) =>
      c.status === "succeeded" &&
      !c.refunded &&
      c.created <= grans &&
      !!c.metadata?.event_id
  );
}

/**
 * De av kandidaterna som saknar bokning.
 *
 * Matchningen går på payment_intent, eftersom det är det bookings.stripe_payment_id
 * bär. En betalning utan payment_intent kan inte matchas och räknas därför som
 * saknad — hellre ett larm att avfärda än en gäst utan biljett.
 */
export function missingBookings(
  candidates: readonly ChargeLike[],
  kandaPaymentIds: ReadonlySet<string>
): ChargeLike[] {
  return candidates.filter((c) => !c.payment_intent || !kandaPaymentIds.has(c.payment_intent));
}

/**
 * Vilka som är NYA sedan sist, så samma betalning inte mejlas varje timme.
 *
 * Ett larm som upprepas varje timme slutar läsas, och då är det lika tyst som
 * inget larm alls.
 */
export function osedda(
  saknade: readonly ChargeLike[],
  redanLarmade: readonly string[]
): ChargeLike[] {
  const sedda = new Set(redanLarmade);
  return saknade.filter((c) => !sedda.has(c.id));
}

/**
 * Listan att spara till nästa körning.
 *
 * Kapas för att app_config-raden inte ska växa i evighet. Nyast först, så det
 * som trillar av är det äldsta — en betalning som legat kvar i flera hundra
 * körningar är ett problem som redan hanterats eller aldrig kommer att bli det.
 */
export function uppdateradHistorik(
  redanLarmade: readonly string[],
  nya: readonly ChargeLike[],
  tak = 200
): string[] {
  return [...nya.map((c) => c.id), ...redanLarmade].slice(0, tak);
}
