import { describe, it, expect } from "vitest";
import { outstandingDebtOre, applyDebt, debtFromRefund } from "../creator-debt";

describe("outstandingDebtOre", () => {
  it("summerar skulder och kvittningar", () => {
    expect(outstandingDebtOre([{ amount_ore: 45000 }, { amount_ore: -20000 }])).toBe(25000);
  });

  it("en helt kvittad skuld är noll", () => {
    expect(outstandingDebtOre([{ amount_ore: 45000 }, { amount_ore: -45000 }])).toBe(0);
  });

  it("golvet är noll — överkvittning gör oss inte skyldiga kreatören", () => {
    // Den riktningen hanteras av avräkningen. Skuldboken pekar åt ett håll.
    expect(outstandingDebtOre([{ amount_ore: 10000 }, { amount_ore: -15000 }])).toBe(0);
  });

  it("tom bok är noll", () => {
    expect(outstandingDebtOre([])).toBe(0);
  });
});

describe("applyDebt", () => {
  it("drar av hela skulden när underlaget räcker", () => {
    // Staffans eget exempel: säljer 1000, har 450 i retur → underlag 550.
    expect(applyDebt({ grossOre: 100000, debtOre: 45000 })).toEqual({
      payableOre: 55000,
      deductedOre: 45000,
      remainingDebtOre: 0,
    });
  });

  it("underlaget blir aldrig negativt", () => {
    // Man kan inte fakturera en negativ lön. Resten ligger kvar.
    expect(applyDebt({ grossOre: 30000, debtOre: 45000 })).toEqual({
      payableOre: 0,
      deductedOre: 30000,
      remainingDebtOre: 15000,
    });
  });

  it("utan skuld går hela underlaget igenom", () => {
    expect(applyDebt({ grossOre: 100000, debtOre: 0 })).toEqual({
      payableOre: 100000,
      deductedOre: 0,
      remainingDebtOre: 0,
    });
  });

  it("utan underlag ligger skulden kvar orörd", () => {
    expect(applyDebt({ grossOre: 0, debtOre: 45000 })).toEqual({
      payableOre: 0,
      deductedOre: 0,
      remainingDebtOre: 45000,
    });
  });

  it("negativa indata behandlas som noll i stället för att vända flödet", () => {
    expect(applyDebt({ grossOre: -500, debtOre: -500 })).toEqual({
      payableOre: 0,
      deductedOre: 0,
      remainingDebtOre: 0,
    });
  });
});

describe("debtFromRefund", () => {
  it("räknar kreatörens andel efter moms", () => {
    // 125 kr med 25 % moms = 100 kr netto. 50 % till partnern = 50 kr.
    expect(debtFromRefund({ refundedOre: 12500, vatRate: 0.25, partnerPercent: 50 })).toBe(5000);
  });

  it("avrundar nedåt, precis som utbetalningen gjorde", () => {
    // Kvittningen får aldrig bli större än det som faktiskt betalades ut.
    const ut = debtFromRefund({ refundedOre: 12501, vatRate: 0.25, partnerPercent: 50 });
    expect(ut).toBeLessThanOrEqual(5001);
  });

  it("ingen återbetalning ger ingen skuld", () => {
    expect(debtFromRefund({ refundedOre: 0, vatRate: 0.25, partnerPercent: 50 })).toBe(0);
  });

  it("en partner utan andel får ingen skuld", () => {
    expect(debtFromRefund({ refundedOre: 12500, vatRate: 0.25, partnerPercent: 0 })).toBe(0);
  });

  it("vägrar orimliga indata i stället för att räkna tyst fel", () => {
    expect(() => debtFromRefund({ refundedOre: 100, vatRate: 25, partnerPercent: 50 })).toThrow();
    expect(() => debtFromRefund({ refundedOre: 100, vatRate: 0.25, partnerPercent: 120 })).toThrow();
  });
});
