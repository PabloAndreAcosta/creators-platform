import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

const LADDA = async () => {
  vi.resetModules();
  return import("../method-config");
};

const ORIG = { ...process.env };
beforeEach(() => { process.env = { ...ORIG }; });
afterEach(() => { process.env = { ...ORIG }; });

/**
 * Gränsen för Klarna.
 *
 * Modulen läser env vid import, så varje fall laddar om den. Gränsen bor i
 * modulen och inte som ett argument, för att de tre kassorna ska slippa bära
 * var sin siffra som förr eller senare skiljer sig åt.
 */
describe("paymentMethodConfigFor", () => {
  it("gör ingenting alls när konfigurationen saknas", async () => {
    delete process.env.STRIPE_PMC_WITHOUT_KLARNA;
    const m = await LADDA();
    expect(m.paymentMethodConfigFor(5_000)).toBeUndefined();
    expect(m.paymentMethodConfigParam(5_000)).toEqual({});
  });

  it("väljer uppsättningen utan Klarna på allt under tusen", async () => {
    process.env.STRIPE_PMC_WITHOUT_KLARNA = "pmc_test";
    const m = await LADDA();
    expect(m.paymentMethodConfigFor(5_000)).toBe("pmc_test");   // 50 kr practica
    expect(m.paymentMethodConfigFor(20_000)).toBe("pmc_test");  // 200 kr allt
    expect(m.paymentMethodConfigFor(60_000)).toBe("pmc_test");  // 600 kr klippkort
  });

  it("låter standarden gälla från tusen kronor", async () => {
    process.env.STRIPE_PMC_WITHOUT_KLARNA = "pmc_test";
    const m = await LADDA();
    expect(m.paymentMethodConfigFor(100_000)).toBeUndefined();  // 1 000 kr klippkort
    expect(m.paymentMethodConfigFor(150_000)).toBeUndefined();
  });

  it("ligger precis på gränsen", async () => {
    process.env.STRIPE_PMC_WITHOUT_KLARNA = "pmc_test";
    const m = await LADDA();
    expect(m.paymentMethodConfigFor(99_999)).toBe("pmc_test");
    expect(m.paymentMethodConfigFor(100_000)).toBeUndefined();
  });

  it("går att flytta med env", async () => {
    process.env.STRIPE_PMC_WITHOUT_KLARNA = "pmc_test";
    process.env.KLARNA_MIN_ORE = "20000";
    const m = await LADDA();
    expect(m.paymentMethodConfigFor(19_999)).toBe("pmc_test");
    expect(m.paymentMethodConfigFor(20_000)).toBeUndefined();
  });

  it("noll stänger av gränsen", async () => {
    process.env.STRIPE_PMC_WITHOUT_KLARNA = "pmc_test";
    process.env.KLARNA_MIN_ORE = "0";
    const m = await LADDA();
    expect(m.paymentMethodConfigFor(5_000)).toBeUndefined();
  });

  it("faller tillbaka på 500 kr vid skräp i env", async () => {
    process.env.KLARNA_MIN_ORE = "inte ett tal";
    const m = await LADDA();
    expect(m.KLARNA_MIN_ORE).toBe(100_000);
  });

  it("skickar aldrig undefined som värde till Stripe", async () => {
    process.env.STRIPE_PMC_WITHOUT_KLARNA = "pmc_test";
    const m = await LADDA();
    expect("payment_method_configuration" in m.paymentMethodConfigParam(150_000)).toBe(false);
  });

  it("döljer inget vid orimliga belopp", async () => {
    process.env.STRIPE_PMC_WITHOUT_KLARNA = "pmc_test";
    const m = await LADDA();
    expect(m.paymentMethodConfigFor(NaN)).toBeUndefined();
    expect(m.paymentMethodConfigFor(Infinity)).toBeUndefined();
  });
});

/**
 * Vakten mot gårdagens fel.
 *
 * Den förra versionen skickade `excluded_payment_method_types`, som Stripe
 * dokumenterar men som inte finns i biblioteket vi kör. Stripe ignorerar
 * okända parametrar TYST, så koden såg ut att fungera och gjorde ingenting.
 * Typkontrollen fångade det inte heller: TypeScript kontrollerar inte
 * överflödiga egenskaper som kommer in via spread.
 *
 * Det här testet läser Stripes egna typer och faller om parametern vi
 * faktiskt skickar inte finns där. Går biblioteket upp en version och
 * parametern dyker upp, är det fritt fram att byta — och då faller inte
 * testet, det slutar bara vara ett hinder.
 */
describe("parametern finns i Stripe-biblioteket", () => {
  const typer = fs.readFileSync(
    path.join(process.cwd(), "node_modules/stripe/types/Checkout/SessionsResource.d.ts"),
    "utf8"
  );

  it("payment_method_configuration accepteras av Checkout", () => {
    expect(typer).toContain("payment_method_configuration");
  });

  it("excluded_payment_method_types finns INTE — därför används den inte", () => {
    // Faller den här dagen någon höjer stripe-paketet: bra, då går det att
    // byta till den enklare vägen och slippa konfigurationen i Dashboard.
    expect(typer).not.toContain("excluded_payment_method_types");
  });
});
