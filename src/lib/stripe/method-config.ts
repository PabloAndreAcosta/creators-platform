/**
 * Vilken uppsättning betalmetoder som ska visas för ett visst belopp.
 *
 * Bakgrund: Klarna kostar 2,99 % plus 4 kr. Den fasta fyran är försumbar på
 * ett klippkort för 1 000 kr och brutal på en practica-biljett för 50 kr, där
 * den äter elva procent av intäkten. Samtidigt är delbetalning värd något
 * just på de dyra köpen — det är där den kan vara skillnaden mellan ett köp
 * och inget köp.
 *
 * Därför en gräns i stället för av eller på.
 *
 * Metoderna i sig styrs fortsatt från Stripe Dashboard, inte härifrån. Koden
 * väljer bara VILKEN konfiguration som gäller; vilka metoder den innehåller
 * bestäms där de hör hemma. Alternativet — att räkna upp metoder i kod med
 * `payment_method_types` — stänger av Stripes automatiska urval och gör varje
 * ny plånbok till en kodändring.
 */

/** Lägsta belopp i ÖRE där Klarna får visas. Standard 500 kr. */
export const KLARNA_MIN_ORE = (() => {
  const raw = Number(process.env.KLARNA_MIN_ORE);
  return Number.isFinite(raw) && raw >= 0 ? raw : 50_000;
})();

/** Konfigurationen utan Klarna. Tom tills den skapats i Dashboard. */
const UTAN_KLARNA = process.env.STRIPE_PMC_WITHOUT_KLARNA || "";

/**
 * Konfigurations-id att skicka med sessionen, eller undefined för kontots
 * standard.
 *
 * Saknas env-variabeln returneras undefined, och allt beter sig precis som
 * förut. Det är avsiktligt: funktionen ska kunna ligga i produktion innan
 * konfigurationen finns, utan att någon betalning påverkas. En gräns som
 * kräver att två saker landar samtidigt är en gräns som landar fel.
 */
export function paymentMethodConfigFor(totalOre: number): string | undefined {
  if (!UTAN_KLARNA) return undefined;
  if (!Number.isFinite(totalOre)) return undefined;
  return totalOre < KLARNA_MIN_ORE ? UTAN_KLARNA : undefined;
}

/**
 * Som ovan, men färdig att spreada in i ett Stripe-anrop:
 * `...paymentMethodConfigParam(total)`.
 *
 * Finns för att anropsställena inte ska behöva upprepa samma
 * undefined-kontroll — en utelämnad kontroll hade skickat
 * `payment_method_configuration: undefined`, vilket Stripe avvisar.
 */
export function paymentMethodConfigParam(
  totalOre: number
): { payment_method_configuration?: string } {
  const id = paymentMethodConfigFor(totalOre);
  return id ? { payment_method_configuration: id } : {};
}
