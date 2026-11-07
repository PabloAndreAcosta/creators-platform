/**
 * I vilket land kreatörens Stripe-konto ska skapas.
 *
 * Svenska kreatörer får som förut ett svenskt konto. Den som verifierat ett
 * bolag i ett annat EU-land (org_number sparas då som momsnummer med prefix,
 * t.ex. EL123456789 – se lib/org-number.ts) får ett konto i bolagets land, så
 * att utbetalningen går i landets valuta till ett lokalt bankkonto.
 *
 * Provat i Stripes testläge 2026-11-07: en svensk plattform kan ta betalt med
 * ett grekiskt konto som säljare (on_behalf_of), i euro och i kronor.
 *
 * Ett befintligt Stripe-konto kan inte byta land; det gäller bara nya konton.
 */
const VIES_TO_STRIPE: Record<string, string> = { EL: "GR", XI: "GB" };

export function stripeAccountCountry(orgNumber: string | null | undefined, companyVerified: boolean): string {
  if (!companyVerified || !orgNumber) return "SE";
  const m = orgNumber.toUpperCase().match(/^([A-Z]{2})/);
  if (!m) return "SE";
  return VIES_TO_STRIPE[m[1]] ?? m[1];
}
