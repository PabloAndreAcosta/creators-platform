import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Gränsen för Klarna.
 *
 * Modulen läser env vid import, så varje fall laddar om den. Gränsen bor i
 * modulen och inte som ett argument, för att anropsställena ska slippa känna
 * till den — tre kassor som var och en bär sin egen siffra är tre siffror som
 * förr eller senare skiljer sig åt.
 */
const LADDA = async () => {
  vi.resetModules();
  return import("../method-config");
};

const ORIG = { ...process.env };
beforeEach(() => { process.env = { ...ORIG }; });
afterEach(() => { process.env = { ...ORIG }; });

describe("excludedPaymentMethodsFor", () => {
  it("döljer Klarna på biljettpriserna", async () => {
    const m = await LADDA();
    expect(m.excludedPaymentMethodsFor(5_000)).toEqual(["klarna"]);   // 50 kr practica
    expect(m.excludedPaymentMethodsFor(10_000)).toEqual(["klarna"]);  // 100 kr workshop
    expect(m.excludedPaymentMethodsFor(20_000)).toEqual(["klarna"]);  // 200 kr allt
  });

  it("låter Klarna vara kvar på klippkorten", async () => {
    const m = await LADDA();
    expect(m.excludedPaymentMethodsFor(60_000)).toEqual([]);   // 600 kr
    expect(m.excludedPaymentMethodsFor(100_000)).toEqual([]);  // 1 000 kr
  });

  it("ligger precis på gränsen", async () => {
    const m = await LADDA();
    expect(m.excludedPaymentMethodsFor(49_999)).toEqual(["klarna"]);
    expect(m.excludedPaymentMethodsFor(50_000)).toEqual([]);
  });

  it("går att flytta med env", async () => {
    process.env.KLARNA_MIN_ORE = "20000"; // 200 kr
    const m = await LADDA();
    expect(m.KLARNA_MIN_ORE).toBe(20_000);
    expect(m.excludedPaymentMethodsFor(19_999)).toEqual(["klarna"]);
    expect(m.excludedPaymentMethodsFor(20_000)).toEqual([]);
  });

  it("noll stänger av hela gränsen", async () => {
    // Avstängningsknappen: Klarna visas igen på alla belopp.
    process.env.KLARNA_MIN_ORE = "0";
    const m = await LADDA();
    expect(m.excludedPaymentMethodsFor(5_000)).toEqual([]);
    expect(m.excludedPaymentMethodsFor(100_000)).toEqual([]);
  });

  it("faller tillbaka på 500 kr vid skräp i env", async () => {
    process.env.KLARNA_MIN_ORE = "inte ett tal";
    const m = await LADDA();
    expect(m.KLARNA_MIN_ORE).toBe(50_000);
  });

  it("döljer inget vid orimliga belopp", async () => {
    const m = await LADDA();
    // Hellre visa en metod för mycket än att en trasig siffra tyst tar bort
    // ett betalsätt för alla.
    expect(m.excludedPaymentMethodsFor(NaN)).toEqual([]);
    expect(m.excludedPaymentMethodsFor(Infinity)).toEqual([]);
  });
});

describe("excludedPaymentMethodsParam", () => {
  it("utelämnar nyckeln helt när inget ska döljas", async () => {
    const m = await LADDA();
    // En tom array är inte samma sak som ingen array för Stripe.
    expect(m.excludedPaymentMethodsParam(60_000)).toEqual({});
    expect("excluded_payment_method_types" in m.excludedPaymentMethodsParam(60_000)).toBe(false);
  });

  it("skickar Klarna under gränsen", async () => {
    const m = await LADDA();
    expect(m.excludedPaymentMethodsParam(5_000)).toEqual({
      excluded_payment_method_types: ["klarna"],
    });
  });
});
