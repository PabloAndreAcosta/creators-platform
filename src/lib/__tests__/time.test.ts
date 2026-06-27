import { describe, it, expect } from "vitest";
import { stockholmLocalToUtcISO, utcToStockholmLocal } from "../time";

describe("stockholmLocalToUtcISO", () => {
  it("summer (CEST, +02:00): 11:00 Stockholm → 09:00Z", () => {
    expect(stockholmLocalToUtcISO("2026-07-11T11:00")).toBe("2026-07-11T09:00:00.000Z");
  });
  it("winter (CET, +01:00): 11:00 Stockholm → 10:00Z", () => {
    expect(stockholmLocalToUtcISO("2026-01-15T11:00")).toBe("2026-01-15T10:00:00.000Z");
  });
  it("returns null for empty/garbage", () => {
    expect(stockholmLocalToUtcISO("")).toBeNull();
    expect(stockholmLocalToUtcISO(null)).toBeNull();
    expect(stockholmLocalToUtcISO("not-a-date")).toBeNull();
  });
});

describe("utcToStockholmLocal", () => {
  it("round-trips summer", () => {
    expect(utcToStockholmLocal("2026-07-11T09:00:00.000Z")).toBe("2026-07-11T11:00");
  });
  it("round-trips winter", () => {
    expect(utcToStockholmLocal("2026-01-15T10:00:00.000Z")).toBe("2026-01-15T11:00");
  });
  it("empty for null", () => {
    expect(utcToStockholmLocal(null)).toBe("");
  });
});
