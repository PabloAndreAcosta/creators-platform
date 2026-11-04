import { describe, expect, it, vi } from "vitest";
import { checkoutTax, needsManualVat, parseVatRate, withTaxRates } from "../vat";

describe("momssats i kassan", () => {
  it("läser satsen från databasen, och null betyder standard", () => {
    expect(parseVatRate(null)).toBeNull();
    expect(parseVatRate("0.060")).toBe(0.06);
    expect(parseVatRate(0.25)).toBe(0.25);
    expect(parseVatRate("skräp")).toBeNull();
  });

  it("använder Stripe Tax för standardsatsen och egen sats för 6 %", () => {
    expect(needsManualVat(null)).toBe(false);
    expect(needsManualVat(0.25)).toBe(false);
    expect(needsManualVat(0.06)).toBe(true);
  });

  it("standard: Stripe Tax på, inga egna satser på raderna", async () => {
    const stripe = { taxRates: { list: vi.fn(), create: vi.fn() } } as never;
    const tax = await checkoutTax(stripe, null);
    expect(tax).toEqual({ automatic_tax: { enabled: true } });
    expect(withTaxRates([{ quantity: 1 }], tax)).toEqual([{ quantity: 1 }]);
  });

  it("6 %: skapar momssatsen en gång, lägger den på varje rad och stänger av Stripe Tax", async () => {
    const create = vi.fn().mockResolvedValue({ id: "txr_6" });
    const list = vi.fn().mockResolvedValue({ data: [] });
    const stripe = { taxRates: { list, create } } as never;
    const tax = await checkoutTax(stripe, 0.06);
    expect(tax.automatic_tax).toBeUndefined();
    expect(tax.taxRates).toEqual(["txr_6"]);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ percentage: 6, inclusive: true, country: "SE" }));
    await checkoutTax(stripe, 0.06);
    expect(create).toHaveBeenCalledTimes(1);
    expect(withTaxRates([{ quantity: 1 }, { quantity: 1 }], tax)).toEqual([
      { quantity: 1, tax_rates: ["txr_6"] },
      { quantity: 1, tax_rates: ["txr_6"] },
    ]);
  });
});
