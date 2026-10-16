import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Gränsen för Klarna.
 *
 * Modulen läser env vid import, så varje fall måste ladda om den. vi.resetModules
 * i stället för att göra gränsen till ett argument: anropsställena ska slippa
 * känna till konfigurationen, och då måste den bo i modulen.
 */

const LADDA = async () => {
  vi.resetModules();
  return import("../method-config");
};

const ORIG = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIG };
});
afterEach(() => {
  process.env = { ...ORIG };
});

describe("paymentMethodConfigFor", () => {
  it("gör ingenting alls när konfigurationen saknas", async () => {
    delete process.env.STRIPE_PMC_WITHOUT_KLARNA;
    const m = await LADDA();
    // Viktigt: funktionen ska kunna ligga i produktion INNAN konfigurationen
    // finns, utan att påverka någon betalning.
    expect(m.paymentMethodConfigFor(5_000)).toBeUndefined();
    expect(m.paymentMethodConfigFor(100_000)).toBeUndefined();
    expect(m.paymentMethodConfigParam(5_000)).toEqual({});
  });

  it("väljer uppsättningen utan Klarna under gränsen", async () => {
    process.env.STRIPE_PMC_WITHOUT_KLARNA = "pmc_test";
    const m = await LADDA();
    expect(m.paymentMethodConfigFor(5_000)).toBe("pmc_test");   // 50 kr practica
    expect(m.paymentMethodConfigFor(20_000)).toBe("pmc_test");  // 200 kr allt
  });

  it("låter kontots standard gälla över gränsen", async () => {
    process.env.STRIPE_PMC_WITHOUT_KLARNA = "pmc_test";
    const m = await LADDA();
    expect(m.paymentMethodConfigFor(60_000)).toBeUndefined();   // 600 kr klippkort
    expect(m.paymentMethodConfigFor(100_000)).toBeUndefined();  // 1000 kr klippkort
  });

  it("ligger precis på gränsen", async () => {
    process.env.STRIPE_PMC_WITHOUT_KLARNA = "pmc_test";
    const m = await LADDA();
    expect(m.paymentMethodConfigFor(49_999)).toBe("pmc_test");
    expect(m.paymentMethodConfigFor(50_000)).toBeUndefined(); // 500 kr → Klarna på
  });

  it("går att flytta med env", async () => {
    process.env.STRIPE_PMC_WITHOUT_KLARNA = "pmc_test";
    process.env.KLARNA_MIN_ORE = "20000"; // 200 kr
    const m = await LADDA();
    expect(m.KLARNA_MIN_ORE).toBe(20_000);
    expect(m.paymentMethodConfigFor(19_999)).toBe("pmc_test");
    expect(m.paymentMethodConfigFor(20_000)).toBeUndefined();
  });

  it("faller tillbaka på 500 kr vid skräp i env", async () => {
    process.env.STRIPE_PMC_WITHOUT_KLARNA = "pmc_test";
    process.env.KLARNA_MIN_ORE = "inte ett tal";
    const m = await LADDA();
    expect(m.KLARNA_MIN_ORE).toBe(50_000);
  });

  it("skickar aldrig undefined som värde till Stripe", async () => {
    process.env.STRIPE_PMC_WITHOUT_KLARNA = "pmc_test";
    const m = await LADDA();
    // Stripe avvisar payment_method_configuration: undefined, så nyckeln
    // måste saknas helt när den inte ska med.
    expect("payment_method_configuration" in m.paymentMethodConfigParam(60_000)).toBe(false);
    expect(m.paymentMethodConfigParam(5_000)).toEqual({ payment_method_configuration: "pmc_test" });
  });

  it("hanterar orimliga belopp utan att krascha", async () => {
    process.env.STRIPE_PMC_WITHOUT_KLARNA = "pmc_test";
    const m = await LADDA();
    expect(m.paymentMethodConfigFor(NaN)).toBeUndefined();
    expect(m.paymentMethodConfigFor(Infinity)).toBeUndefined();
  });
});
