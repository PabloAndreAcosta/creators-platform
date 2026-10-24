/**
 * Vilken uppsättning betalmetoder som ska visas för ett visst belopp.
 *
 * Bakgrund: Klarna kostar 2,99 % plus 4 kr. Den fasta fyran är försumbar på
 * ett klippkort för 1 000 kr och brutal på en practica-biljett för 50 kr, där
 * den äter elva procent av intäkten. Samtidigt är delbetalning värd något
 * just på de dyra köpen — det är där den kan vara skillnaden mellan ett köp
 * och inget köp. Därför en gräns i stället för av eller på.
 *
 * VARFÖR INTE excluded_payment_method_types: Stripe dokumenterar den
 * parametern för precis det här, och den vore enklare — inget att skapa i
 * Dashboard. Men den finns inte i det Stripe-bibliotek vi kör (17.7.0) och
 * inte i den API-version klienten är låst till (2025-02-24.acacia). Stripe
 * ignorerar okända parametrar TYST, så den hade sett ut att fungera och inte
 * gjort någonting. Den vägen kan tas när biblioteket och API-versionen höjs,
 * och inte tidigare.
 *
 * payment_method_configuration finns däremot i versionen. Koden väljer bara
 * VILKEN konfiguration sessionen ska använda; vilka metoder den innehåller
 * bestäms i Dashboard, där de hör hemma.
 */

/**
 * Lägsta belopp i ÖRE där Klarna får visas. Standard 1 000 kr (Pablo
 * 2026-10-17).
 *
 * Gränsen ligger på det största klippkortet och inte mellan biljetter och
 * klippkort. Det betyder att även sexhundrakortet betalas med kort eller
 * plånbok — på det beloppet kostar Klarna 21:94 mot kortets 10:80, och
 * delbetalning av 600 kr är sällan det som avgör ett köp.
 *
 * Noll stänger av gränsen: alla belopp är större än eller lika med noll, så
 * standardkonfigurationen gäller alltid.
 */
export const KLARNA_MIN_ORE = (() => {
  const raw = Number(process.env.KLARNA_MIN_ORE);
  return Number.isFinite(raw) && raw >= 0 ? raw : 100_000;
})();

/** Konfigurationen utan Klarna. Tom tills den skapats i Dashboard. */
const UTAN_KLARNA = process.env.STRIPE_PMC_WITHOUT_KLARNA || "";

/**
 * Konfigurations-id att skicka med sessionen, eller undefined för kontots
 * standard.
 *
 * Saknas env-variabeln returneras undefined och allt beter sig som förut.
 * Det är avsiktligt: koden ska kunna ligga i produktion innan konfigurationen
 * finns, utan att påverka någon betalning. En gräns som kräver att två saker
 * landar samtidigt är en gräns som landar fel.
 *
 * Observera att det här INTE är samma sak som att gränsen tyst inte
 * fungerar — skillnaden mot det ignorerade excluded-anropet är att den här
 * vägen är avsedd att vara overksam tills den konfigurerats, och att det
 * syns genom att env-variabeln är tom.
 */
export function paymentMethodConfigFor(totalOre: number): string | undefined {
  if (!UTAN_KLARNA) return undefined;
  if (!Number.isFinite(totalOre)) return undefined;
  if (KLARNA_MIN_ORE <= 0) return undefined;
  return totalOre < KLARNA_MIN_ORE ? UTAN_KLARNA : undefined;
}

/**
 * Färdig att spreada in i ett Stripe-anrop:
 * `...paymentMethodConfigParam(total)`.
 *
 * Nyckeln utelämnas helt när standarden ska gälla. Stripe avvisar
 * `payment_method_configuration: undefined`.
 */
export function paymentMethodConfigParam(
  totalOre: number
): { payment_method_configuration?: string } {
  const id = paymentMethodConfigFor(totalOre);
  return id ? { payment_method_configuration: id } : {};
}
