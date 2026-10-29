import { describe, it, expect } from "vitest";
import { isValidVoucherCode, codesMatch, parseVoucherAmount, voucherScopeId } from "../voucher";

describe("kupongkod", () => {
  it("4–6 siffror", () => {
    expect(isValidVoucherCode("1234")).toBe(true);
    expect(isValidVoucherCode("123456")).toBe(true);
    expect(isValidVoucherCode("123")).toBe(false);
    expect(isValidVoucherCode("12a4")).toBe(false);
  });
  it("jämför exakt", () => {
    expect(codesMatch("4821", "4821")).toBe(true);
    expect(codesMatch(" 4821 ", "4821")).toBe(true);
    expect(codesMatch("4822", "4821")).toBe(false);
    expect(codesMatch("48210", "4821")).toBe(false);
  });
});

describe("belopp", () => {
  it("kronor med komma eller punkt, upp till taket", () => {
    expect(parseVoucherAmount("100", 10_000)).toBe(10_000);
    expect(parseVoucherAmount("89,50", 10_000)).toBe(8_950);
    expect(parseVoucherAmount("89.5", 10_000)).toBe(8_950);
  });
  it("vägrar över taket, noll och skräp", () => {
    expect(parseVoucherAmount("100,01", 10_000)).toBeNull();
    expect(parseVoucherAmount("0", 10_000)).toBeNull();
    expect(parseVoucherAmount("hundra", 10_000)).toBeNull();
  });
});

describe("var inställningen bor", () => {
  it("serien går före kvällen", () => {
    expect(voucherScopeId({ id: "kvall", series_id: "serie" })).toBe("serie");
    expect(voucherScopeId({ id: "kvall", series_id: null })).toBe("kvall");
  });
});
