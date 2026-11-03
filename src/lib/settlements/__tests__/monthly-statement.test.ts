import { describe, it, expect } from "vitest";
import {
  buildMonthlyStatement,
  firstWeekdayOfMonth,
  previousPeriod,
  statementCsv,
  statementIsDue,
  type StatementPayout,
  type StatementSupplement,
} from "../monthly-statement";

function payout(over: Partial<StatementPayout>): StatementPayout {
  return {
    listingId: "l1", eventDate: "2026-10-01", title: "The Lab", tickets: 10,
    grossOre: 184000, refundedOre: 0, vatOre: 36800, basisOre: 147200, vatRate: 0.25,
    partnerPercent: 50, amountOre: 73600, status: "paid", paidAt: "2026-10-03T05:00:00Z",
    transferId: "tr_a", ...over,
  };
}

const HEADERS = {
  date: "Datum", evening: "Kväll", tickets: "Biljetter", gross: "Brutto", vat: "Moms", basis: "Underlag",
  share: "Andel", paid: "Utbetalt", paidDate: "Dag", transfers: "Överföring", total: "Summa", earlier: "Tidigare",
};

describe("månadsavräkning", () => {
  it("räknar oktober 2026 som den faktiskt betalades, kompletteringen inräknad", () => {
    const payouts = [
      payout({}),
      payout({ listingId: "l15", eventDate: "2026-10-15", tickets: 11, grossOre: 181000, vatOre: 36200, basisOre: 144800, amountOre: 72400, transferId: "tr_b", paidAt: "2026-10-16T05:00:00Z" }),
      // Hör till september och ska inte med.
      payout({ listingId: "l9", eventDate: "2026-09-29", amountOre: 33600 }),
    ];
    const supplements: StatementSupplement[] = [{
      listingId: "l15", eventDate: "2026-10-15", title: "The Lab", seq: 1, amountOre: 8000, dueOre: 80400,
      grossOre: 201000, refundedOre: 0, vatOre: 40200, basisOre: 160800, status: "paid",
      paidAt: "2026-10-16T14:33:57Z", transferId: "tr_k",
    }];
    const s = buildMonthlyStatement("2026-10", payouts, supplements);

    expect(s.rows.map((r) => r.eventDate)).toEqual(["2026-10-01", "2026-10-15"]);
    const r15 = s.rows[1];
    expect(r15.grossOre).toBe(201000);
    expect(r15.dueOre).toBe(80400);
    expect(r15.paidOre).toBe(80400);
    expect(r15.transferIds).toEqual(["tr_b", "tr_k"]);
    expect(s.totals.paidOre).toBe(73600 + 80400);
    expect(s.totals.dueOre).toBe(s.totals.paidOre);
    expect(s.earlier).toEqual([]);
  });

  it("en komplettering som betalas nästa månad hamnar under tidigare kvällar där", () => {
    const supplements: StatementSupplement[] = [{
      listingId: "l29", eventDate: "2026-10-29", title: "The Lab", seq: 1, amountOre: 5000, dueOre: 25000,
      grossOre: 0, refundedOre: 0, vatOre: 0, basisOre: 0, status: "paid",
      paidAt: "2026-11-02T08:00:00Z", transferId: "tr_x",
    }];
    const nov = buildMonthlyStatement("2026-11", [], supplements);
    expect(nov.earlier).toEqual([{ eventDate: "2026-10-29", title: "The Lab", amountOre: 5000, paidDate: "2026-11-02", transferId: "tr_x" }]);
    expect(nov.totals.earlierOre).toBe(5000);

    // ...och står INTE också i oktobers underlag, även om det skapas efter utbetalningen.
    const okt = buildMonthlyStatement("2026-10", [payout({ listingId: "l29", eventDate: "2026-10-29", amountOre: 20000 })], supplements);
    expect(okt.rows[0].paidOre).toBe(20000);
    expect(okt.rows[0].dueOre).toBe(20000);
  });

  it("en avräkning som inte gått än syns men räknas inte som utbetald", () => {
    const s = buildMonthlyStatement("2026-10", [payout({ status: "dry_run", paidAt: null, transferId: null })], []);
    expect(s.rows[0].pending).toBe(true);
    expect(s.rows[0].paidOre).toBe(0);
    expect(s.rows[0].dueOre).toBe(73600);
  });

  it("utbetalningsdagen är svensk tid", () => {
    // 23:30 UTC den 2:a är redan den 3:e i Stockholm.
    const s = buildMonthlyStatement("2026-10", [payout({ paidAt: "2026-10-02T23:30:00Z" })], []);
    expect(s.rows[0].paidDate).toBe("2026-10-03");
  });

  it("filen öppnas rätt i svenskt Excel", () => {
    const csv = statementCsv(buildMonthlyStatement("2026-10", [payout({ title: 'The "Lab"; torsdag' })], []), HEADERS);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("1840,00;368,00;1472,00;736,00;736,00");
    expect(csv).toContain('"The ""Lab""; torsdag"');
  });
});

describe("när avräkningen ska gå", () => {
  it("första vardagen i månaden", () => {
    expect(firstWeekdayOfMonth(2026, 11)).toBe(2); // 1 nov 2026 är en söndag
    expect(firstWeekdayOfMonth(2026, 12)).toBe(1); // tisdag
    expect(firstWeekdayOfMonth(2026, 8)).toBe(3); // lör, sön, mån
  });
  it("inte på helgen före första vardagen, men varje dag därefter", () => {
    expect(statementIsDue("2026-11-01")).toBe(false);
    expect(statementIsDue("2026-11-02")).toBe(true);
    expect(statementIsDue("2026-11-20")).toBe(true);
  });
  it("förra månaden, även över årsskiftet", () => {
    expect(previousPeriod("2026-11-02")).toBe("2026-10");
    expect(previousPeriod("2027-01-04")).toBe("2026-12");
  });
});
