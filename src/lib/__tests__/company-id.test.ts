import { describe, it, expect } from "vitest";
import { parseCompanyId } from "../org-number";

describe("parseCompanyId", () => {
  it("svenskt organisationsnummer som förut", () => {
    expect(parseCompanyId("559401-8326")).toEqual({ country: "SE", stored: "5594018326", org: "5594018326" });
    expect(parseCompanyId("SE559401832601")).toEqual({ country: "SE", stored: "5594018326", org: "5594018326" });
  });
  it("grekiskt momsnummer, även skrivet med GR", () => {
    expect(parseCompanyId("EL123456789")).toEqual({ country: "EL", stored: "EL123456789", vat: "123456789" });
    expect(parseCompanyId("gr 123 456 789")).toEqual({ country: "EL", stored: "EL123456789", vat: "123456789" });
  });
  it("andra EU-länder", () => {
    expect(parseCompanyId("DE123456789")?.country).toBe("DE");
    expect(parseCompanyId("NL123456789B01")?.stored).toBe("NL123456789B01");
  });
  it("land utanför VIES och skräp nekas", () => {
    expect(parseCompanyId("US123456789")).toBeNull();
    expect(parseCompanyId("GB123456789")).toBeNull();
    expect(parseCompanyId("123")).toBeNull();
    expect(parseCompanyId("")).toBeNull();
  });
  it("felaktigt svenskt nummer nekas", () => {
    expect(parseCompanyId("559401-8327")).toBeNull();
  });
});
