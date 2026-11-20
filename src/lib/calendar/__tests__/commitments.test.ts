import { describe, it, expect } from "vitest";
import {
  validateCommitment,
  isDateInCommitments,
  commitmentDaysInRange,
  isValidDateKey,
  kronorToOre,
  oreToKronorInput,
  commitmentTotals,
  summarizeEconomics,
} from "../commitments";

const base = {
  title: "Kizomba-festival Lissabon",
  kind: "festival",
  role: "taxidansare",
  start_date: "2026-12-04",
  end_date: "2026-12-06",
  location: "Lissabon",
  note: "",
};

describe("validateCommitment", () => {
  it("godkänner ett giltigt åtagande och trimmar fälten", () => {
    const r = validateCommitment({ ...base, title: "  Festival  ", role: "  ", location: " Lissabon " });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.title).toBe("Festival");
      expect(r.value.role).toBeNull();
      expect(r.value.location).toBe("Lissabon");
      expect(r.value.note).toBeNull();
    }
  });

  it("godkänner en endagsföreteelse (start = slut)", () => {
    expect(validateCommitment({ ...base, end_date: base.start_date }).ok).toBe(true);
  });

  it.each([
    [{ title: "" }, "titleRequired"],
    [{ title: "   " }, "titleRequired"],
    [{ title: "x".repeat(121) }, "titleTooLong"],
    [{ kind: "konsert" }, "kindInvalid"],
    [{ kind: undefined }, "kindInvalid"],
    [{ role: "x".repeat(61) }, "roleTooLong"],
    [{ start_date: "2026-02-30" }, "dateInvalid"],
    [{ end_date: "6 dec" }, "dateInvalid"],
    [{ end_date: "2026-12-03" }, "endBeforeStart"],
    [{ location: "x".repeat(161) }, "locationTooLong"],
    [{ note: "x".repeat(1001) }, "noteTooLong"],
  ])("avvisar %o med %s", (patch, code) => {
    const r = validateCommitment({ ...base, ...patch });
    expect(r).toEqual({ ok: false, code });
  });

  it("släpper igenom gränsvärdena", () => {
    const r = validateCommitment({
      ...base,
      title: "x".repeat(120),
      role: "x".repeat(60),
      location: "x".repeat(160),
      note: "x".repeat(1000),
    });
    expect(r.ok).toBe(true);
  });
});

describe("isValidDateKey", () => {
  it("känner igen skottdagar", () => {
    expect(isValidDateKey("2028-02-29")).toBe(true);
    expect(isValidDateKey("2027-02-29")).toBe(false);
  });
});

describe("isDateInCommitments", () => {
  const list = [{ start_date: "2026-12-04", end_date: "2026-12-06" }];
  it("räknar in start- och slutdag", () => {
    expect(isDateInCommitments("2026-12-04", list)).toBe(true);
    expect(isDateInCommitments("2026-12-05", list)).toBe(true);
    expect(isDateInCommitments("2026-12-06", list)).toBe(true);
  });
  it("släpper dagarna utanför", () => {
    expect(isDateInCommitments("2026-12-03", list)).toBe(false);
    expect(isDateInCommitments("2026-12-07", list)).toBe(false);
    expect(isDateInCommitments("2026-12-05", [])).toBe(false);
  });
});

describe("commitmentDaysInRange", () => {
  it("expanderar över månadsskiftet men klipper mot intervallet", () => {
    const days = commitmentDaysInRange(
      [{ start_date: "2026-11-29", end_date: "2026-12-02" }],
      "2026-12-01",
      "2026-12-31"
    );
    expect([...days].sort()).toEqual(["2026-12-01", "2026-12-02"]);
  });

  it("slår ihop överlappande åtaganden och hoppar över de utanför", () => {
    const days = commitmentDaysInRange(
      [
        { start_date: "2026-12-10", end_date: "2026-12-11" },
        { start_date: "2026-12-11", end_date: "2026-12-12" },
        { start_date: "2027-01-05", end_date: "2027-01-06" },
      ],
      "2026-12-01",
      "2026-12-31"
    );
    expect([...days].sort()).toEqual(["2026-12-10", "2026-12-11", "2026-12-12"]);
  });
});

describe("ekonomi", () => {
  it("validerar syfte och belopp", () => {
    expect(validateCommitment({ ...base, purpose: "semester" })).toEqual({ ok: false, code: "purposeInvalid" });
    expect(validateCommitment({ ...base, cost_food_ore: -1 })).toEqual({ ok: false, code: "amountInvalid" });
    expect(validateCommitment({ ...base, cost_food_ore: 12.5 })).toEqual({ ok: false, code: "amountInvalid" });
    expect(validateCommitment({ ...base, income_ore: 100_000_001 })).toEqual({ ok: false, code: "amountInvalid" });
    expect(validateCommitment({ ...base, cost_note: "x".repeat(501) })).toEqual({ ok: false, code: "costNoteTooLong" });
    const r = validateCommitment({ ...base, purpose: "jobb", cost_transport_ore: 180000, income_ore: null });
    expect(r.ok && r.value.purpose).toBe("jobb");
    expect(r.ok && r.value.cost_transport_ore).toBe(180000);
    expect(r.ok && r.value.cost_lodging_ore).toBeNull();
  });

  it("kronorToOre läser svenska skrivsätt", () => {
    expect(kronorToOre("")).toBeNull();
    expect(kronorToOre("1800")).toBe(180000);
    expect(kronorToOre("1 800")).toBe(180000);
    expect(kronorToOre("1.800")).toBe(180000);
    expect(kronorToOre("1800,50")).toBe(180050);
    expect(kronorToOre("12.5")).toBe(1250);
    expect(kronorToOre("450 kr")).toBe(45000);
    expect(kronorToOre("-5")).toBe("invalid");
    expect(kronorToOre("abc")).toBe("invalid");
    expect(kronorToOre("2000000")).toBe("invalid");
  });

  it("oreToKronorInput är kronorToOres motsats", () => {
    expect(oreToKronorInput(null)).toBe("");
    expect(oreToKronorInput(180000)).toBe("1800");
    expect(oreToKronorInput(180050)).toBe("1800,50");
    expect(kronorToOre(oreToKronorInput(180050))).toBe(180050);
  });

  it("commitmentTotals: null utan belopp, annars kostnad/intäkt/netto", () => {
    expect(commitmentTotals({})).toBeNull();
    expect(
      commitmentTotals({ cost_transport_ore: 180000, cost_lodging_ore: 0, cost_ticket_ore: 120000, income_ore: 250000 })
    ).toEqual({ cost: 300000, income: 250000, net: -50000 });
    expect(commitmentTotals({ income_ore: 100000 })).toEqual({ cost: 0, income: 100000, net: 100000 });
  });

  it("summarizeEconomics summerar totalt och per syfte", () => {
    const s = summarizeEconomics([
      { purpose: "jobb", cost_transport_ore: 100000, income_ore: 300000 },
      { purpose: "jobb", cost_food_ore: 50000 },
      { purpose: "larande", cost_ticket_ore: 200000 },
      { cost_other_ore: 10000 },
      { purpose: "noje" }, // inga belopp — räknas inte
    ]);
    expect(s.counted).toBe(4);
    expect({ cost: s.cost, income: s.income, net: s.net }).toEqual({ cost: 360000, income: 300000, net: -60000 });
    expect(s.byPurpose.jobb).toEqual({ cost: 150000, income: 300000, net: 150000 });
    expect(s.byPurpose.larande).toEqual({ cost: 200000, income: 0, net: -200000 });
    expect(s.byPurpose.none).toEqual({ cost: 10000, income: 0, net: -10000 });
    expect(s.byPurpose.noje).toBeUndefined();
  });
});
