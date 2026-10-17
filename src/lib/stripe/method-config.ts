/**
 * Vilka betalmetoder som ska döljas för ett visst belopp.
 *
 * Bakgrund: Klarna kostar 2,99 % plus 4 kr. Den fasta fyran är försumbar på
 * ett klippkort för 1 000 kr och brutal på en practica-biljett för 50 kr, där
 * den äter elva procent av intäkten. Samtidigt är delbetalning värd något
 * just på de dyra köpen — det är där den kan vara skillnaden mellan ett köp
 * och inget köp.
 *
 * Därför en gräns i stället för av eller på.
 *
 * Genomförandet är `excluded_payment_method_types`, vilket är Stripes egen
 * rekommendation när en metod ska bort beroende på vad som ligger i köpet.
 * Övervägt och valt bort: en andra betalmetodkonfiguration i Dashboard. Den
 * hade fungerat men krävt att någon skapar den för hand, kopierar ett id och
 * sätter det i en env-variabel — tre steg som kan göras fel eller glömmas, och
 * som dessutom måste upprepas i varje ny miljö.
 *
 * Det här rör INTE vilka metoder som finns. Kort, Apple Pay, Google Pay och
 * Klarna slås fortsatt på och av i Stripe Dashboard. Här avgörs bara om
 * Klarna ska visas för just det här beloppet.
 */

/**
 * Lägsta belopp i ÖRE där Klarna får visas. Standard 500 kr, vilket skiljer
 * biljetterna (50–200 kr) från klippkorten (600–1 000 kr).
 *
 * Noll stänger av hela gränsen: alla belopp är större än eller lika med noll,
 * så Klarna visas alltid. Det är avstängningsknappen om något skulle bli fel.
 */
export const KLARNA_MIN_ORE = (() => {
  const raw = Number(process.env.KLARNA_MIN_ORE);
  return Number.isFinite(raw) && raw >= 0 ? raw : 50_000;
})();

/**
 * Metoder att utesluta för beloppet. Tom lista = visa allt som är påslaget.
 *
 * Orimliga belopp (NaN, Infinity) ger tom lista. Hellre visa en metod för
 * mycket än att en trasig siffra tyst tar bort ett betalsätt för alla.
 */
export function excludedPaymentMethodsFor(totalOre: number): "klarna"[] {
  if (!Number.isFinite(totalOre)) return [];
  if (KLARNA_MIN_ORE <= 0) return [];
  return totalOre < KLARNA_MIN_ORE ? ["klarna"] : [];
}

/**
 * Färdig att spreada in i ett Stripe-anrop:
 * `...excludedPaymentMethodsParam(total)`.
 *
 * Nyckeln utelämnas helt när inget ska uteslutas. En tom array är inte samma
 * sak som ingen array för Stripe, och att skicka den vore att be om ett fel
 * på de flesta köp.
 */
export function excludedPaymentMethodsParam(
  totalOre: number
): { excluded_payment_method_types?: "klarna"[] } {
  const excluded = excludedPaymentMethodsFor(totalOre);
  return excluded.length > 0 ? { excluded_payment_method_types: excluded } : {};
}
