import { describe, it, expect } from "vitest";
import { wageFromLabourBudget } from "../wage";
import { employerFee, ratesFor } from "../rates";

describe("employerFee", () => {
  it("full avgift för den som är född 1959 eller senare", () => {
    const f = employerFee({ birthYear: 1985, paidOn: "2026-11-25", grossOre: 100_000 });
    expect(f.basis).toBe("full");
    expect(f.feeOre).toBe(31_420);
  });

  it("bara ålderspensionsavgift för den som fyllt 67 vid årets ingång", () => {
    // Född 1958: 67 år vid ingången av 2026.
    const f = employerFee({ birthYear: 1958, paidOn: "2026-11-25", grossOre: 100_000 });
    expect(f.basis).toBe("senior");
    expect(f.feeOre).toBe(10_210);
  });

  it("räknar åldern vid årets ingång, inte på utbetalningsdagen", () => {
    // Född 1959 fyller 67 under 2026 men hade inte fyllt vid ingången.
    const f = employerFee({ birthYear: 1959, paidOn: "2026-12-30", grossOre: 100_000 });
    expect(f.basis).toBe("full");
  });

  it("ingen avgift för födda 1937 eller tidigare", () => {
    const f = employerFee({ birthYear: 1937, paidOn: "2026-11-25", grossOre: 100_000 });
    expect(f).toEqual({ feeOre: 0, basis: "none" });
  });

  it("nedsatt avgift för unga under perioden", () => {
    const f = employerFee({ birthYear: 2005, paidOn: "2026-05-10", grossOre: 100_000 });
    expect(f.basis).toBe("youth");
    expect(f.feeOre).toBe(20_810);
  });

  it("ingen ungdomsnedsättning före 1 april 2026", () => {
    const f = employerFee({ birthYear: 2005, paidOn: "2026-03-31", grossOre: 100_000 });
    expect(f.basis).toBe("full");
  });

  it("ungdomstaket gäller per månad, inte per pass", () => {
    // Redan 24 500 kr den här månaden → bara 500 kr ryms under taket.
    const f = employerFee({
      birthYear: 2005,
      paidOn: "2026-05-28",
      grossOre: 100_000,
      monthToDateGrossOre: 2_450_000,
    });
    expect(f.feeOre).toBe(Math.round(50_000 * 0.2081 + 50_000 * 0.3142));
  });

  it("kastar för ett år utan inlagda satser i stället för att gissa", () => {
    expect(() => ratesFor(2031)).toThrow(/2031/);
  });
});

describe("wageFromLabourBudget", () => {
  it("450 kr i egen regi ger ca 240 kr netto", () => {
    // Jämförelse: SAMekonomi gav ca 235 kr på samma 450 kr, efter sina 2 %.
    const w = wageFromLabourBudget({ labourBudgetOre: 45_000, birthYear: 1990, paidOn: "2026-11-25" });

    expect(w.grossOre).toBe(34_200);
    expect(w.employerFeeOre).toBe(10_746);
    expect(w.withholdingOre).toBe(10_200);
    expect(w.netOre).toBe(24_000);
    expect(w.wageOre + w.holidayPayOre).toBe(w.grossOre);
  });

  it("stämmer mot SAMekonomis exempelkalkyl efter deras avgift", () => {
    // 450 − 2 % = 441 kr till löneberäkning. Deras besked: brutto 336 kr.
    // Vi avrundar nedåt så att avgiften aldrig spräcker budgeten → 335 kr.
    const w = wageFromLabourBudget({ labourBudgetOre: 44_100, birthYear: 1990, paidOn: "2026-11-25" });
    expect(w.grossOre).toBe(33_500);
  });

  it("lön + avgift + avrundningsrest summerar exakt till budgeten", () => {
    for (const budget of [0, 1, 99, 30_000, 45_000, 123_456, 2_000_000]) {
      for (const birthYear of [1937, 1950, 1990, 2005]) {
        const w = wageFromLabourBudget({ labourBudgetOre: budget, birthYear, paidOn: "2026-06-01" });
        expect(w.grossOre + w.employerFeeOre + w.roundingRestOre).toBe(budget);
        expect(w.roundingRestOre).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("semesterersättningen är 12 % av lönen och ligger i bruttot", () => {
    const w = wageFromLabourBudget({ labourBudgetOre: 131_420, birthYear: 1990, paidOn: "2026-11-25" });
    expect(w.grossOre).toBe(100_000);
    expect(w.holidayPayOre).toBe(100_000 - Math.round(100_000 / 1.12));
  });

  it("jämkning och färdigt tabellbelopp går före 30 %", () => {
    const base = { labourBudgetOre: 131_420, birthYear: 1990, paidOn: "2026-11-25" };
    expect(wageFromLabourBudget({ ...base, withholdingRate: 0.15 }).withholdingOre).toBe(15_000);
    expect(wageFromLabourBudget({ ...base, withholdingOre: 21_300 }).withholdingOre).toBe(21_300);
  });

  it("vägrar skatteavdrag större än lönen", () => {
    expect(() =>
      wageFromLabourBudget({ labourBudgetOre: 10_000, birthYear: 1990, paidOn: "2026-11-25", withholdingOre: 50_000 }),
    ).toThrow();
  });
});
