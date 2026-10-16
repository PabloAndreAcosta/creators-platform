/**
 * Efterköp: betalning för en kväll som redan varit.
 *
 * Bakgrund. Biljettförsäljningen stänger vid midnatt efter kvällen, och det är
 * rätt — ingen ska kunna köpa sig in på något som inte finns kvar. Men folk
 * bestämmer sig efteråt, dörren är full när de kommer, eller de tänker betala
 * på vägen hem. Då fanns ingen väg alls: gästen stod med pengarna i handen och
 * systemet sa nej.
 *
 * Marie Androv är fallet som drev fram det här. Hon dansade på The Lab den 15
 * oktober, ville betala på morgonen, och kunde bara köpa en biljett till NÄSTA
 * torsdag. Intäkten hamnade på fel kväll och statistiken blev fel på båda.
 *
 * Fönstret är avsiktligt kort och öppnas bara av någon som stod i dörren. Det
 * här är inte en andra chans att sälja gamla biljetter — det är ett sätt att ta
 * betalt av den som faktiskt var där.
 */

import { stockholmLocalToUtcISO } from "@/lib/time";

/**
 * Hur länge efterköpet är möjligt, räknat från att kvällen tog slut.
 *
 * Ett dygn: hela dagen efter. Den som dansade på torsdagskvällen kan betala
 * under fredagen. Längre än så och det slutar handla om kvällen som var och
 * börjar likna försäljning av ett minne.
 */
export const EFTERKOP_FONSTER_TIMMAR = 24;

/** Slutet av eventdagen i svensk tid, samma gräns som sale-state använder. */
function slutetAvKvallen(eventDate: string | null | undefined): Date | null {
  if (!eventDate) return null;
  const iso = stockholmLocalToUtcISO(`${eventDate}T23:59`);
  return iso ? new Date(iso) : null;
}

export type EfterkopLage =
  /** Kvällen pågår eller är inte här än — vanlig försäljning gäller. */
  | { kind: "inte_aktuellt" }
  /** Efterköp är möjligt. */
  | { kind: "oppet"; stangerVid: Date }
  /** Kvällen är för gammal. */
  | { kind: "stangt"; stangdeVid: Date };

/**
 * Var befinner sig kvällen?
 *
 * Datumlösa poster (tjänster) har aldrig "varit" och får aldrig efterköp —
 * för dem finns ingen kväll att ha missat.
 */
export function efterkopLage(eventDate: string | null | undefined, now: Date): EfterkopLage {
  const slut = slutetAvKvallen(eventDate);
  if (!slut) return { kind: "inte_aktuellt" };

  // Kvällen har inte tagit slut: vanlig försäljning är öppen och ska användas.
  if (now <= slut) return { kind: "inte_aktuellt" };

  const stanger = new Date(slut.getTime() + EFTERKOP_FONSTER_TIMMAR * 3_600_000);
  if (now <= stanger) return { kind: "oppet", stangerVid: stanger };
  return { kind: "stangt", stangdeVid: stanger };
}

/** Kortformen för en grind som bara ska släppa igenom eller neka. */
export function efterkopOppet(eventDate: string | null | undefined, now: Date): boolean {
  return efterkopLage(eventDate, now).kind === "oppet";
}
