import type Stripe from "stripe";

/**
 * Momssatsen i kassan.
 *
 * Utan satt sats räknar Stripe Tax (25 %, kontots standard). Har evenemanget
 * eller kortet en egen sats (listings.vat_rate), till exempel 6 % för entré
 * till danstillställningar, används en manuell momssats i stället — Stripe Tax
 * och manuella satser går inte att blanda i samma kassa.
 *
 * Priset för kunden ändras aldrig: momsen ligger inuti priset (inclusive).
 * Det som ändras är hur Stripe delar upp beloppet i pris och moms.
 *
 * Beslut: Ludvig 2026-11-04. 6 %: danskvällar, månadsfester, The Lab och
 * serviceavgiften på dem. 25 %: workshops, kurser, coaching, uppdrag.
 */

/** Den standardsats Stripe Tax räknar när inget annat är satt. */
export const STANDARD_VAT_RATE = 0.25;

/** Läser satsen från databasen (numeric kommer som text). null = standard. */
export function parseVatRate(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n < 1 ? n : null;
}

/** Behöver kassan en egen sats, eller räcker Stripe Tax? */
export function needsManualVat(rate: number | null): rate is number {
  return rate !== null && Math.abs(rate - STANDARD_VAT_RATE) > 1e-9;
}

const cache = new Map<string, Promise<string>>();

/** Id för en inkluderad svensk momssats i procent, skapad en gång per konto och läge. */
export function manualTaxRateId(stripe: Stripe, rate: number): Promise<string> {
  const percentage = Math.round(rate * 10000) / 100;
  const key = `${percentage}`;
  let hit = cache.get(key);
  if (!hit) {
    hit = (async () => {
      const list = await stripe.taxRates.list({ active: true, inclusive: true, limit: 100 });
      const found = list.data.find(
        (r) => r.percentage === percentage && r.country === "SE" && r.metadata?.usha_vat === key,
      );
      if (found) return found.id;
      const created = await stripe.taxRates.create({
        display_name: "Moms",
        percentage,
        inclusive: true,
        country: "SE",
        jurisdiction: "SE",
        tax_type: "vat",
        description: `Moms ${percentage} % (Usha, listings.vat_rate)`,
        metadata: { usha_vat: key },
      });
      return created.id;
    })();
    hit.catch(() => cache.delete(key));
    cache.set(key, hit);
  }
  return hit;
}

export interface CheckoutTax {
  /** Sätts bara när Stripe Tax ska räkna. */
  automatic_tax?: { enabled: true };
  /** Läggs på varje rad när en egen sats gäller. */
  taxRates?: string[];
}

/** Vad kassan ska skicka till Stripe för en viss sats. */
export async function checkoutTax(stripe: Stripe, rate: number | null): Promise<CheckoutTax> {
  if (!needsManualVat(rate)) return { automatic_tax: { enabled: true } };
  return { taxRates: [await manualTaxRateId(stripe, rate)] };
}

/** Lägger den egna satsen på varje rad, även serviceavgiften (den följer biljettens sats). */
type LineItem = Stripe.Checkout.SessionCreateParams.LineItem;
export function withTaxRates(items: LineItem[], tax: CheckoutTax): LineItem[] {
  if (!tax.taxRates) return items;
  return items.map((i) => ({ ...i, tax_rates: tax.taxRates }));
}
