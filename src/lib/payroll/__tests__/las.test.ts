import { describe, it, expect } from "vitest";
import { lasStatus } from "../las";

/** Alla torsdagar från start (inklusive) i n veckor, som ISO-datum. */
function thursdays(startIso: string, weeks: number): string[] {
  const out: string[] = [];
  const d = new Date(`${startIso}T00:00:00Z`);
  for (let i = 0; i < weeks; i++) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return out;
}

describe("lasStatus", () => {
  it("två pass i månaden räknas bara som passdagarna", () => {
    const s = lasStatus(["2026-10-01", "2026-10-15"], "2026-10-31");
    expect(s.days).toBe(2);
    expect(s.level).toBe("ok");
  });

  it("tre pass i samma kalendermånad räknar även dagarna mellan (LAS 3 §)", () => {
    const s = lasStatus(["2026-10-01", "2026-10-08", "2026-10-15"], "2026-10-31");
    expect(s.days).toBe(15);
  });

  it("varje torsdag i ett år närmar sig gränsen", () => {
    // 2026-01-01 är en torsdag.
    const s = lasStatus(thursdays("2026-01-01", 52), "2026-12-31");
    expect(s.days).toBeGreaterThan(250);
    expect(s.level).not.toBe("limit");
  });

  it("varje torsdag i drygt ett och ett halvt år spräcker 12 månader", () => {
    const s = lasStatus(thursdays("2026-01-01", 80), "2027-07-15");
    expect(s.level).toBe("limit");
  });

  it("pass äldre än fem år räknas inte", () => {
    const s = lasStatus(["2020-01-02", "2020-01-09", "2020-01-16", "2026-10-01"], "2026-10-31");
    expect(s.days).toBe(1);
  });

  it("varnar när få dagar återstår", () => {
    const passes = thursdays("2026-01-01", 64);
    const s = lasStatus(passes, passes[passes.length - 1]);
    expect(["warn", "limit"]).toContain(s.level);
  });
});
