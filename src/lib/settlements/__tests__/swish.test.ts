import { describe, it, expect } from "vitest";
import { buildMonthlyStatement, statementCsv, type StatementPayout } from "../monthly-statement";
import { swishPartnerShareOre } from "../swish";

const base: StatementPayout = {
  listingId: "l1", eventDate: "2026-11-12", title: "The Lab", tickets: 10,
  grossOre: 130000, refundedOre: 0, vatOre: 7358, basisOre: 122642, vatRate: 0.06, partnerPercent: 50,
  amountOre: 61321, status: "paid", paidAt: "2026-11-13T08:00:00Z", transferId: "tr_1",
};

describe("avräkning: Swish utanför Stripe", () => {
  it("partnerns andel av Swish räknas som kortdelen: moms ur priset, sedan procent", () => {
    // 3 biljetter à 130 kr = 390 kr inkl 6 % moms → underlag 367,92 → 50 % = 183,96
    const ore = swishPartnerShareOre({ tickets: 3, grossOre: 39000, refundedOre: 0 }, 0.06, 50);
    expect(ore).toBe(18396);
    expect(swishPartnerShareOre({ tickets: 0, grossOre: 0, refundedOre: 0 }, 0.06, 50)).toBe(0);
  });

  it("Swish-beloppen följer med raden och summeras, utan att röra Stripe-delen", () => {
    const s = buildMonthlyStatement("2026-11", [{ ...base, swishTickets: 3, swishGrossOre: 39000, swishDueOre: 18396 }], []);
    expect(s.rows[0].swishGrossOre).toBe(39000);
    expect(s.rows[0].swishDueOre).toBe(18396);
    expect(s.rows[0].dueOre).toBe(61321); // Stripe-andelen oförändrad
    expect(s.totals.swishGrossOre).toBe(39000);
    expect(s.totals.swishDueOre).toBe(18396);
    expect(s.totals.dueOre).toBe(61321);
  });

  it("en kväll utan Swish får nollor, och CSV:n får inga Swish-kolumner", () => {
    const s = buildMonthlyStatement("2026-11", [base], []);
    expect(s.rows[0].swishGrossOre).toBe(0);
    const csv = statementCsv(s, {
      date: "Datum", evening: "Kväll", tickets: "Biljetter", gross: "Brutto", vat: "Moms", basis: "Underlag",
      share: "Andel", paid: "Utbetalt", paidDate: "Dag", transfers: "Överföring", total: "Summa", earlier: "Tidigare",
      swishGross: "Swish", swishShare: "Swish-andel",
    });
    expect(csv.split("\r\n")[0]).not.toContain("Swish");
  });

  it("med Swish läggs två kolumner sist, på rad och summa", () => {
    const s = buildMonthlyStatement("2026-11", [{ ...base, swishTickets: 3, swishGrossOre: 39000, swishDueOre: 18396 }], []);
    const lines = statementCsv(s, {
      date: "Datum", evening: "Kväll", tickets: "Biljetter", gross: "Brutto", vat: "Moms", basis: "Underlag",
      share: "Andel", paid: "Utbetalt", paidDate: "Dag", transfers: "Överföring", total: "Summa", earlier: "Tidigare",
      swishGross: "Swish", swishShare: "Swish-andel",
    }).split("\r\n");
    expect(lines[0].endsWith(";Swish;Swish-andel")).toBe(true);
    expect(lines[1].endsWith(";390,00;183,96")).toBe(true);
    expect(lines[2].startsWith("Summa;")).toBe(true);
    expect(lines[2].endsWith(";390,00;183,96")).toBe(true);
  });
});
