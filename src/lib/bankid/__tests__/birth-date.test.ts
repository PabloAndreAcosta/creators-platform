import { describe, it, expect } from "vitest";
import { birthDateOrNull, ageOnDate } from "../birth-date";

describe("birthDateOrNull", () => {
  it("tar ÅÅÅÅ-MM-DD och ÅÅÅÅMMDD", () => {
    expect(birthDateOrNull("1990-07-20")).toBe("1990-07-20");
    expect(birthDateOrNull("19900720")).toBe("1990-07-20");
    expect(birthDateOrNull("1990-07-20T00:00:00Z")).toBe("1990-07-20");
  });
  it("sparar inget som inte är ett riktigt datum", () => {
    expect(birthDateOrNull("1990-02-30")).toBeNull();
    expect(birthDateOrNull("")).toBeNull();
    expect(birthDateOrNull(undefined)).toBeNull();
  });
});

describe("ageOnDate", () => {
  it("fyller år på födelsedagen", () => {
    expect(ageOnDate("2008-11-12", "2026-11-11")).toBe(17);
    expect(ageOnDate("2008-11-12", "2026-11-12")).toBe(18);
  });
});
