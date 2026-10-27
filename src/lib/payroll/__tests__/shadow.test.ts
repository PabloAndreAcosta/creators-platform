import { describe, it, expect } from "vitest";
import { shadowRun, budgetPerPassForAkassa, AKASSA_MONTH_THRESHOLD_ORE } from "../shadow";
import { SCENARIOS } from "../scenarios";
import { wageFromLabourBudget } from "../wage";

const byKey = (k: string) => {
  const s = SCENARIOS.find((x) => x.key === k);
  if (!s) throw new Error(k);
  return shadowRun(s.creator, s.passes, s.today, s);
};

describe("shadowRun", () => {
  it("egen regi ger aldrig mindre netto än via SAMekonomi", () => {
    for (const s of SCENARIOS) {
      const r = shadowRun(s.creator, s.passes, s.today, s);
      for (const l of r.lines) {
        expect(l.ownRegime.netOre).toBeGreaterThanOrEqual(l.samekonomi.netOre);
      }
    }
  });

  it("SAMekonomis 2 % räknas på budgeten före lön", () => {
    const r = byKey("forsta-fakturan");
    expect(r.lines[0].samekonomi.feeToSamOre).toBe(736);
    expect(r.lines[0].samekonomi.labourBudgetOre).toBe(36_800 - 736);
  });

  it("lönen betalas dagen efter passet och hamnar i den månaden", () => {
    const r = shadowRun({ birthYear: 1990 }, [{ date: "2026-10-31", labourBudgetOre: 45_000 }], "2026-11-30");
    expect(r.lines[0].paidOn).toBe("2026-11-01");
    expect(r.months.map((m) => m.month)).toEqual(["2026-11"]);
  });

  it("en sen återbetalning dras från nästa pass, inte från det utbetalda", () => {
    const r = byKey("sen-aterbetalning");
    expect(r.lines[0].debtDeductedOre).toBe(0);
    expect(r.lines[1].debtDeductedOre).toBe(45_000);
    expect(r.lines[1].ownRegime.netOre).toBe(0);
    expect(r.lines[2].debtDeductedOre).toBe(0);
    expect(r.totals.openDebtOre).toBe(0);
  });

  it("skuld som är större än nästa pass rullar vidare", () => {
    const r = shadowRun(
      { birthYear: 1990 },
      [
        { date: "2026-11-05", labourBudgetOre: 90_000, lateRefundOre: 90_000 },
        { date: "2026-11-12", labourBudgetOre: 45_000 },
      ],
      "2026-11-30",
    );
    expect(r.lines[1].debtDeductedOre).toBe(45_000);
    expect(r.totals.openDebtOre).toBe(45_000);
  });

  it("varje torsdag i 18 månader slår i LAS-gränsen", () => {
    expect(byKey("varje-torsdag").las.level).toBe("limit");
  });

  it("år utan satser stoppar körningen om projektion inte begärts", () => {
    expect(() => shadowRun({ birthYear: 1990 }, [{ date: "2027-03-01", labourBudgetOre: 45_000 }], "2027-03-31")).toThrow(
      /2027/,
    );
  });

  it("projektion markerar raderna och behåller åldersregeln", () => {
    // Född 1959: 66 vid ingången av 2026, 67 vid ingången av 2027 → senior 2027.
    const r = shadowRun({ birthYear: 1959 }, [{ date: "2027-03-01", labourBudgetOre: 45_000 }], "2027-03-31", {
      projectMissingYears: true,
    });
    expect(r.lines[0].projected).toBe(true);
    expect(r.lines[0].ownRegime.feeBasis).toBe("senior");
  });

  it("ungdomsavgiften ger mer netto än full avgift på samma pass", () => {
    const ung = byKey("ung-kreator").totals.ownNetOre;
    const full = shadowRun({ birthYear: 1990 }, SCENARIOS.find((s) => s.key === "ung-kreator")!.passes, "2026-11-30")
      .totals.ownNetOre;
    expect(ung).toBeGreaterThan(full);
  });

  it("månadens skattekontobelopp är avgift plus skatteavdrag", () => {
    for (const m of byKey("ung-kreator").months) {
      expect(m.ownTaxAccountOre).toBe(m.ownEmployerFeeOre + m.ownWithholdingOre);
    }
  });

  it("fyra klasser à 450 kr når inte a-kassans 11 000 kr", () => {
    expect(byKey("ung-kreator").months[0].reachesAkassaMonth).toBe(false);
  });
});

describe("budgetPerPassForAkassa", () => {
  it("hittar den lägsta budget som når 11 000 kr i månaden", () => {
    const b = budgetPerPassForAkassa(1990, "2026-11-25", 4);
    const at = wageFromLabourBudget({ labourBudgetOre: b, birthYear: 1990, paidOn: "2026-11-25" }).grossOre;
    const below = wageFromLabourBudget({ labourBudgetOre: b - 100, birthYear: 1990, paidOn: "2026-11-25" }).grossOre;
    expect(at * 4).toBeGreaterThanOrEqual(AKASSA_MONTH_THRESHOLD_ORE);
    expect(below * 4).toBeLessThan(AKASSA_MONTH_THRESHOLD_ORE);
  });
});
