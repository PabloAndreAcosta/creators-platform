import { describe, it, expect } from "vitest";
import { computeAge } from "../age";

describe("computeAge", () => {
  it("returns exact age on a birthday", () => {
    expect(computeAge("2000-04-30", new Date("2026-04-30T12:00:00Z"))).toBe(26);
  });

  it("returns one less when birthday hasn't happened yet this year", () => {
    expect(computeAge("2008-12-01", new Date("2026-04-30T12:00:00Z"))).toBe(17);
  });

  it("returns full age when birthday already passed this year", () => {
    expect(computeAge("2008-01-01", new Date("2026-04-30T12:00:00Z"))).toBe(18);
  });

  it("returns NaN for invalid date strings", () => {
    expect(computeAge("not-a-date", new Date("2026-04-30T12:00:00Z"))).toBeNaN();
  });

  it("treats day-before-18th-birthday as 17", () => {
    expect(computeAge("2008-05-01", new Date("2026-04-30T12:00:00Z"))).toBe(17);
  });

  it("treats 18th birthday exactly as 18", () => {
    expect(computeAge("2008-04-30", new Date("2026-04-30T12:00:00Z"))).toBe(18);
  });
});
