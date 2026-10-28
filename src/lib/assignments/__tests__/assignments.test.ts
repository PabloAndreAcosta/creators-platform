import { describe, it, expect, afterEach } from "vitest";
import { assignmentRoute, payrollRouteLive } from "../route";
import { quoteAssignment, creatorReceivesOre } from "../quote";

describe("assignmentRoute", () => {
  it("verifierat bolag fakturerar själv", () => {
    expect(assignmentRoute({ is_company: true, company_verified_at: "2026-05-01" })).toBe("own_company");
  });

  it("overifierat bolag behandlas som inget bolag", () => {
    expect(assignmentRoute({ is_company: true, company_verified_at: null })).toBe("payroll");
  });

  it("utan bolag blir det lön via Usha", () => {
    expect(assignmentRoute({ is_company: false, company_verified_at: null })).toBe("payroll");
    expect(assignmentRoute({ is_company: null, company_verified_at: null })).toBe("payroll");
  });

  it("Ushas eget konto går före allt annat", () => {
    expect(assignmentRoute({ is_company: false, company_verified_at: null, is_usha_owned_seller: true })).toBe("usha");
  });
});

describe("payrollRouteLive", () => {
  const before = { ...process.env };
  afterEach(() => {
    process.env = { ...before };
  });

  it("är avstängd som standard", () => {
    delete process.env.ASSIGNMENT_PAYROLL_LIVE;
    expect(payrollRouteLive()).toBe(false);
  });

  it("piloten kräver att både beställare och kreatör står på listan", () => {
    delete process.env.ASSIGNMENT_PAYROLL_LIVE;
    process.env.ASSIGNMENT_PAYROLL_PILOT_IDS = "kund-test, kreator-test";
    expect(payrollRouteLive({ customerId: "kund-test", creatorId: "kreator-test" })).toBe(true);
    expect(payrollRouteLive({ customerId: "kund-test", creatorId: "riktig-kreator" })).toBe(false);
    expect(payrollRouteLive({ customerId: "riktig-kund", creatorId: "kreator-test" })).toBe(false);
    expect(payrollRouteLive()).toBe(false);
  });

  it("flaggan för alla går före piloten", () => {
    process.env.ASSIGNMENT_PAYROLL_LIVE = "true";
    delete process.env.ASSIGNMENT_PAYROLL_PILOT_IDS;
    expect(payrollRouteLive({ customerId: "vem-som-helst", creatorId: "vem-som-helst" })).toBe(true);
  });

  it("öppnas inte av att betalningar öppnas för alla", () => {
    process.env.NEXT_PUBLIC_PAYMENTS_OPEN = "true";
    delete process.env.ASSIGNMENT_PAYROLL_LIVE;
    expect(payrollRouteLive()).toBe(false);
  });
});

describe("quoteAssignment", () => {
  const paidOn = "2026-11-25";

  it("eget bolag: provision av priset, resten till bolaget", () => {
    const q = quoteAssignment({ priceKr: 1000, route: "own_company", commissionRate: 0.08, paidOn });
    expect(q).toEqual({ route: "own_company", priceOre: 100_000, commissionOre: 8_000, toCreatorOre: 92_000 });
  });

  it("lön: moms ur priset, provision på beloppet exkl. moms, resten är lönebudget", () => {
    const q = quoteAssignment({ priceKr: 1000, route: "payroll", commissionRate: 0.08, paidOn });
    if (q.route !== "payroll") throw new Error("fel väg");
    expect(q.vatOre).toBe(20_000);
    expect(q.commissionOre).toBe(6_400);
    expect(q.wage.labourBudgetOre).toBe(73_600);
    expect(q.estimated).toBe(true);
  });

  it("varje öre av priset går att redovisa", () => {
    for (const priceKr of [0, 1, 99, 450, 1000, 3333, 12_500]) {
      for (const rate of [0.03, 0.05, 0.08]) {
        const q = quoteAssignment({ priceKr, route: "payroll", commissionRate: rate, paidOn });
        if (q.route !== "payroll") throw new Error("fel väg");
        const w = q.wage;
        expect(q.vatOre + q.commissionOre + w.grossOre + w.employerFeeOre + w.roundingRestOre).toBe(q.priceOre);
      }
    }
  });

  it("okänt födelseår räknas försiktigt: aldrig mer än för en 30-åring", () => {
    const okand = quoteAssignment({ priceKr: 1000, route: "payroll", commissionRate: 0.08, paidOn });
    const ung = quoteAssignment({ priceKr: 1000, route: "payroll", commissionRate: 0.08, paidOn, birthYear: 2005 });
    expect(creatorReceivesOre(ung)).toBeGreaterThanOrEqual(creatorReceivesOre(okand));
  });

  it("lönevägen ger mindre i handen än bolagsvägen på samma pris — skatten är redan betald", () => {
    const lon = quoteAssignment({ priceKr: 1000, route: "payroll", commissionRate: 0.08, paidOn });
    const bolag = quoteAssignment({ priceKr: 1000, route: "own_company", commissionRate: 0.08, paidOn });
    expect(creatorReceivesOre(lon)).toBeLessThan(creatorReceivesOre(bolag));
  });

  it("ett år utan satser ger en uppskattning i stället för att krascha sidan", () => {
    const q = quoteAssignment({ priceKr: 1000, route: "payroll", commissionRate: 0.08, paidOn: "2027-06-01", birthYear: 1990 });
    if (q.route !== "payroll") throw new Error("fel väg");
    expect(q.estimated).toBe(true);
    expect(q.wage.netOre).toBeGreaterThan(0);
  });

  it("vägrar negativt pris och orimlig provision", () => {
    expect(() => quoteAssignment({ priceKr: -1, route: "payroll", commissionRate: 0.08, paidOn })).toThrow();
    expect(() => quoteAssignment({ priceKr: 100, route: "payroll", commissionRate: 8, paidOn })).toThrow();
  });
});
