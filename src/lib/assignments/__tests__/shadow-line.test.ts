import { describe, it, expect } from "vitest";
import { buildShadowLine } from "../shadow-line";

const base = {
  bookingId: "b1",
  creatorId: "c1",
  scheduledAt: "2026-11-12T18:00:00Z",
  priceKr: 1000,
  commissionRate: 0.08,
};

describe("buildShadowLine", () => {
  it("summerar exakt till priset — samma villkor som tabellens check", () => {
    for (const priceKr of [0, 1, 450, 1000, 7777]) {
      const r = buildShadowLine({ ...base, priceKr });
      expect(r.vat_ore + r.commission_ore + r.gross_ore + r.employer_fee_ore + r.rounding_rest_ore).toBe(r.price_ore);
    }
  });

  it("passets dag räknas i Stockholm, lönen dagen efter", () => {
    // 23.30 UTC den 12:e är 00.30 den 13:e i Stockholm.
    const r = buildShadowLine({ ...base, scheduledAt: "2026-11-12T23:30:00Z" });
    expect(r.pass_date).toBe("2026-11-13");
    expect(r.paid_on).toBe("2026-11-14");
  });

  it("SAMekonomi-raden tar 2 % av samma lönebudget och ger mindre netto", () => {
    const r = buildShadowLine(base);
    expect(r.sam_fee_ore).toBe(Math.round(r.labour_budget_ore * 0.02));
    expect(r.sam_net_ore).toBeLessThanOrEqual(r.net_ore);
  });

  it("utan födelseår är raden en uppskattning", () => {
    expect(buildShadowLine(base).estimated).toBe(true);
    expect(buildShadowLine({ ...base, birthYear: 1985 }).estimated).toBe(false);
  });

  it("ett pass i ett år utan satser blir en uppskattning, inte ett fel", () => {
    const r = buildShadowLine({ ...base, scheduledAt: "2027-03-01T18:00:00Z", birthYear: 1985 });
    expect(r.estimated).toBe(true);
    expect(r.net_ore).toBeGreaterThan(0);
  });
});
