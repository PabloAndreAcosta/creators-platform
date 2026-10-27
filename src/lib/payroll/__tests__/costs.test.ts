import { describe, it, expect } from "vitest";
import { monthlyCost, breakEvenMonthlyBudgetOre, OWN_REGIME_COSTS, FORTNOX_LON_COSTS } from "../costs";

const v = { grossOre: 1_000_000, employees: 3, payouts: 10, signings: 1 };

describe("monthlyCost", () => {
  it("räknar varje sorts post på sin egen grund", () => {
    const c = monthlyCost(
      [
        { key: "a", label: "", source: "offert", kind: "per_month", ore: 1_000 },
        { key: "b", label: "", source: "offert", kind: "per_employee_month", ore: 100 },
        { key: "c", label: "", source: "offert", kind: "per_payout", ore: 10 },
        { key: "d", label: "", source: "offert", kind: "per_signing", ore: 40 },
        { key: "e", label: "", source: "offert", kind: "share_of_gross", rate: 0.001 },
      ],
      v,
    );
    expect(c.lines.map((l) => l.ore)).toEqual([1_000, 300, 100, 40, 1_000]);
    expect(c.totalOre).toBe(2_440);
  });

  it("varje post i tabellerna har en källa", () => {
    for (const i of [...OWN_REGIME_COSTS, ...FORTNOX_LON_COSTS]) {
      expect(["verifierad", "tredjepart", "offert"]).toContain(i.source);
    }
  });
});

describe("breakEvenMonthlyBudgetOre", () => {
  it("ligger där egen regi och 2 % kostar lika", () => {
    const opts = { samFeeRate: 0.02, budgetPerPassOre: 45_000, passesPerEmployee: 4 };
    const be = breakEvenMonthlyBudgetOre(OWN_REGIME_COSTS, opts);
    expect(Number.isFinite(be)).toBe(true);
    const own = (b: number) =>
      monthlyCost(OWN_REGIME_COSTS, {
        grossOre: Math.round(b / 1.3142),
        employees: Math.ceil(b / 45_000 / 4),
        payouts: Math.ceil(b / 45_000),
        signings: 0,
      }).totalOre;
    expect(own(be)).toBeLessThanOrEqual(be * 0.02);
    expect(own(be - 200_00)).toBeGreaterThan((be - 200_00) * 0.02);
  });

  it("ger oändligt om rörliga kostnader alltid överstiger avgiften", () => {
    const dyr = [{ key: "x", label: "", source: "offert" as const, kind: "share_of_gross" as const, rate: 0.5 }];
    expect(breakEvenMonthlyBudgetOre(dyr, { samFeeRate: 0.02, budgetPerPassOre: 45_000, passesPerEmployee: 4 })).toBe(
      Infinity,
    );
  });
});
