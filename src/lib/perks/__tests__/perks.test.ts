import { describe, it, expect } from "vitest";
import { isPerkEligible } from "../eligibility";
import { PERKS, pickText, validatePerks, type Perk } from "../catalog";
import { buildPerkOffers, type PerkCodeRow } from "../offers";

const CODE_ID = "11111111-2222-4333-8444-555555555555";

function perk(over: Partial<Perk> = {}): Perk {
  return {
    id: "bastu-test",
    provider: "Testbastun AB",
    city: "Stockholm",
    category: "sauna",
    title: { sv: "Bastukväll", en: "Sauna night" },
    description: { sv: "Ett pass i bastun." },
    seriesSlug: "testbastun",
    accessCodeId: CODE_ID,
    ...over,
  };
}

function row(over: Partial<PerkCodeRow> = {}): PerkCodeRow {
  return { id: CODE_ID, series_slug: "testbastun", code: "USHA-BASTU", discount_price: null, is_active: true, ...over };
}

describe("isPerkEligible", () => {
  it("släpper in den som är inloggad", () => {
    expect(isPerkEligible({ id: "u1" })).toBe(true);
  });
  it("nekar utloggade och konton utan id", () => {
    expect(isPerkEligible(null)).toBe(false);
    expect(isPerkEligible(undefined)).toBe(false);
    expect(isPerkEligible({ id: "" })).toBe(false);
  });
});

describe("förmånslistan", () => {
  it("är giltig", () => {
    expect(validatePerks(PERKS)).toEqual([]);
  });
  it("fångar en kod i stället för kodradens id", () => {
    expect(validatePerks([perk({ accessCodeId: "USHA-BASTU" })]).join()).toMatch(/uuid/);
  });
  it("fångar dubbla id och fel datum", () => {
    const errs = validatePerks([perk(), perk({ validUntil: "1 jan" })]);
    expect(errs.some((e) => e.includes("finns redan"))).toBe(true);
    expect(errs.some((e) => e.includes("validUntil"))).toBe(true);
  });
  it("faller tillbaka på svenska", () => {
    expect(pickText({ sv: "Hej", en: "Hi" }, "en")).toBe("Hi");
    expect(pickText({ sv: "Hej" }, "es")).toBe("Hej");
  });
});

describe("buildPerkOffers", () => {
  const today = "2026-11-25";

  it("gratis när discount_price är NULL, koden bara till behöriga", () => {
    const [shown] = buildPerkOffers([perk()], [row()], { eligible: false, today });
    expect(shown).toMatchObject({ kind: "free", priceKr: null, code: null });
    const [mine] = buildPerkOffers([perk()], [row()], { eligible: true, today });
    expect(mine.code).toBe("USHA-BASTU");
  });

  it("förmånspris när discount_price är satt", () => {
    const [o] = buildPerkOffers([perk()], [row({ discount_price: 90 })], { eligible: true, today });
    expect(o).toMatchObject({ kind: "discount", priceKr: 90 });
  });

  it("visar aldrig en förmån som inte går att lösa in", () => {
    expect(buildPerkOffers([perk()], [], { eligible: true, today })).toEqual([]);
    expect(buildPerkOffers([perk()], [row({ is_active: false })], { eligible: true, today })).toEqual([]);
    expect(buildPerkOffers([perk()], [row({ series_slug: "annan-serie" })], { eligible: true, today })).toEqual([]);
  });

  it("döljer en förmån vars sista dag passerat, men inte samma dag", () => {
    expect(buildPerkOffers([perk({ validUntil: "2026-11-24" })], [row()], { eligible: true, today })).toEqual([]);
    expect(buildPerkOffers([perk({ validUntil: today })], [row()], { eligible: true, today })).toHaveLength(1);
  });
});
