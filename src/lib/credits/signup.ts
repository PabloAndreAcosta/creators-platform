/**
 * Välkomstavdrag: 50 kr till den som skapar konto, att använda på ett köp.
 *
 * Två beslut styr reglerna, och båda är affärsbeslut snarare än tekniska.
 *
 * USHA BÄR HELA AVDRAGET. Avräkningen mot en samarbetspartner räknas på vad
 * köparen betalat, så ett avdrag skulle annars tyst halvera partnerns andel —
 * de skulle finansiera halva marknadsföringen utan att ha sagt ja. Därför
 * lagras avdraget separat på bokningen och läggs tillbaka i underlaget innan
 * delningen. Partnern får sin andel av ordinarie pris.
 *
 * MINSTA KÖP 120 KR. Utan gräns blir en practica-biljett för 50 kr gratis, och
 * ett köparkonto kräver bara en mejladress. Gränsen håller avdraget borta från
 * gratis inträde utan att stänga ute den vanligaste biljetten.
 *
 * Gränsen låg på 150 kr fram till 2026-09-29 och sänktes till 120 för att
 * zouk-tisdagarna kostar just 120 — avdraget gällde alltså inte den biljett
 * flest köper. Sänkningen är ett medvetet minusbeslut: på en kväll med
 * partner går Usha back ett par kronor på ett förstagångsköp (se
 * ushaNetAfterCreditOre). Ett nytt konto är värt mer än så, och kostnaden
 * bärs av Usha — varken partnern eller kreatören är med och betalar den.
 */

/** Avdragets storlek i öre. */
export const SIGNUP_CREDIT_ORE = 5000;

/** Lägsta ordersumma i öre för att avdraget ska gälla. */
export const SIGNUP_CREDIT_MIN_SPEND_ORE = 12000;

export interface CreditInput {
  /** Kvarvarande avdrag i öre. 0 eller saknat = inget att använda. */
  creditOre: number | null | undefined;
  /** Ordersumman före avdrag, i öre. Serviceavgift räknas inte in. */
  subtotalOre: number;
  /** Har avdraget gått ut? */
  expired?: boolean;
  /** Är det redan använt? */
  used?: boolean;
  minSpendOre?: number;
}

/**
 * Hur mycket av avdraget som får användas på det här köpet.
 *
 * Aldrig mer än ordersumman: ett köp får bli noll kronor men aldrig negativt,
 * och Stripe vägrar ändå en rad med negativt belopp.
 */
export function applicableCredit(input: CreditInput): number {
  const min = input.minSpendOre ?? SIGNUP_CREDIT_MIN_SPEND_ORE;
  const credit = input.creditOre ?? 0;

  if (input.used || input.expired) return 0;
  if (credit <= 0) return 0;
  if (!Number.isFinite(input.subtotalOre) || input.subtotalOre <= 0) return 0;
  if (input.subtotalOre < min) return 0;

  return Math.min(credit, input.subtotalOre);
}

/**
 * Underlaget som partnerns andel ska räknas på.
 *
 * Betalt belopp plus det avdrag Usha stod för. Utan detta skulle en kväll där
 * halva publiken använt sitt välkomstavdrag ge partnern en oförklarligt låg
 * utbetalning — och den förklaringen vill ingen behöva ge i efterhand.
 */
export function settlementBasisOre(row: {
  amount_paid?: number | null;
  credit_applied_ore?: number | null;
}): number {
  return (row.amount_paid ?? 0) + (row.credit_applied_ore ?? 0);
}

/**
 * Vad Usha har kvar av ett köp efter moms, partnerns andel och avdraget.
 *
 * Finns här för att gränsen på 150 kr ska gå att kontrollera i stället för att
 * bara tros på. Partnern får sin andel av ordinarie pris — avdraget är helt
 * Ushas kostnad — så ju billigare biljetten är, desto större del av Ushas egen
 * andel äter avdraget upp.
 *
 * Räknat på The Lab och zouk-tisdagarna (partner 50 %, moms 25 %):
 *   120 kr → -2 kr    150 kr → +10 kr    200 kr → +30 kr
 *
 * Minusposten på 120 kr är känd och accepterad: gränsen ligger där för att
 * avdraget ska gälla zouk-tisdagarna, och Usha bär mellanskillnaden. Funktionen
 * finns kvar så att nästa ändring av gränsen börjar i siffror — och så att det
 * syns om priset eller partnerandelen flyttar sig så att minusposten växer.
 */
export function ushaNetAfterCreditOre(input: {
  priceOre: number;
  partnerPercent: number;
  vatRate: number;
  creditOre?: number;
}): number {
  const netOfVat = input.priceOre / (1 + input.vatRate);
  const ushaShare = netOfVat * (1 - input.partnerPercent / 100);
  return Math.round(ushaShare - (input.creditOre ?? 0));
}
