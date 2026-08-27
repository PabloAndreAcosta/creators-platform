/**
 * Delning av biljettintäkt mellan arrangör och samarbetspartner.
 *
 * Bakgrund: en kväll kan arrangeras tillsammans med en lokal som tar en andel
 * av biljettintäkten. Usha är säljare mot köparen — hela beloppet är Ushas
 * omsättning — och partnerns andel är en kostnad som förs över efter att
 * kvällen ägt rum.
 *
 * Beräkningen bor i en ren funktion av två skäl. Den avgör hur mycket pengar
 * som lämnar bolaget, så den måste gå att testa uttömmande utan databas. Och
 * underlaget som visas för båda parter måste komma från exakt samma kod som
 * gör överföringen — annars kan rapporten och verkligheten glida isär.
 *
 * Alla belopp i ÖRE. bookings.amount_paid lagras i öre; ticket_types.price i
 * kronor. Blanda inte.
 */

export interface SplitInput {
  /** Summa av amount_paid för betalda bokningar på kvällen. */
  grossOre: number;
  /** Summa återbetalt. Dras av före delningen. */
  refundedOre?: number;
  /**
   * Momssats som decimal, t.ex. 0.25. Biljettpriser anges inklusive moms, så
   * momsen räknas ur beloppet och inte ovanpå.
   *
   * Satsen för entré till dansevenemang är inte självklar och ska bekräftas av
   * revisor — därför är den en parameter och inte en konstant.
   */
  vatRate: number;
  /** Partnerns andel i procent av underlaget, t.ex. 50. */
  partnerPercent: number;
}

export interface Split {
  grossOre: number;
  refundedOre: number;
  /** Kvar efter återbetalningar, inklusive moms. */
  netInclVatOre: number;
  /** Momsen som ligger i netInclVatOre. */
  vatOre: number;
  /** Underlaget för delningen: netto exklusive moms. */
  basisOre: number;
  partnerOre: number;
  organiserOre: number;
  partnerPercent: number;
  vatRate: number;
}

/**
 * Delar en kvälls biljettintäkt.
 *
 * Avrundning: partnerns andel avrundas nedåt och arrangören får resten. Det
 * garanterar att de två delarna summerar EXAKT till underlaget — ett ensamt öre
 * får varken uppstå eller försvinna, eftersom summan ska stämma mot både
 * Stripe-överföringen och bokföringen.
 */
export function splitEventRevenue(input: SplitInput): Split {
  const { grossOre, vatRate, partnerPercent } = input;
  const refundedOre = input.refundedOre ?? 0;

  if (!Number.isFinite(grossOre) || grossOre < 0) {
    throw new Error("grossOre måste vara ett tal ≥ 0");
  }
  if (refundedOre < 0) throw new Error("refundedOre kan inte vara negativt");
  if (vatRate < 0 || vatRate >= 1) throw new Error("vatRate anges som decimal, t.ex. 0.25");
  if (partnerPercent < 0 || partnerPercent > 100) {
    throw new Error("partnerPercent måste ligga mellan 0 och 100");
  }

  // Fler återbetalningar än intäkter ska inte ge negativt underlag och därmed
  // en överföring åt fel håll. Golvet är noll.
  const netInclVatOre = Math.max(0, grossOre - refundedOre);

  // Priset innehåller momsen: 125 kr med 25 % moms är 100 kr netto och 25 kr moms.
  const vatOre = Math.round(netInclVatOre * (vatRate / (1 + vatRate)));
  const basisOre = netInclVatOre - vatOre;

  const partnerOre = Math.floor((basisOre * partnerPercent) / 100);
  const organiserOre = basisOre - partnerOre;

  return {
    grossOre,
    refundedOre,
    netInclVatOre,
    vatOre,
    basisOre,
    partnerOre,
    organiserOre,
    partnerPercent,
    vatRate,
  };
}

/** Öre → "1 234,50 kr", för underlag som människor läser. */
export function formatOre(ore: number): string {
  return `${(ore / 100).toLocaleString("sv-SE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} kr`;
}
