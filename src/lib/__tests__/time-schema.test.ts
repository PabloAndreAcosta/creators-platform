import { describe, it, expect } from "vitest";
import { stockholmOffset, stockholmEventISO } from "@/lib/time";

// schema.org-tider MÅSTE bära tidszon. Utan offset tolkar Google, Bing och
// språkmodeller tiden som UTC, och en kväll 17:00 i Stockholm presenteras som
// 19:00. Kalendern och seriesidan byggde var sin naiv sträng innan #412.
describe("stockholmOffset", () => {
  it("ger sommartid i juli", () => {
    expect(stockholmOffset("2026-07-15")).toBe("+02:00");
  });

  it("ger vintertid i januari", () => {
    expect(stockholmOffset("2026-01-15")).toBe("+01:00");
  });

  it("växlar vid DST-skiftet i oktober", () => {
    expect(stockholmOffset("2026-10-24")).toBe("+02:00");
    expect(stockholmOffset("2026-10-27")).toBe("+01:00");
  });

  it("faller tillbaka på vintertid vid skräpdatum", () => {
    expect(stockholmOffset("inte-ett-datum")).toBe("+01:00");
  });
});

describe("stockholmEventISO", () => {
  it("skriver ut offset för en kväll i oktober", () => {
    expect(stockholmEventISO("2026-10-06", "17:00:00")).toBe("2026-10-06T17:00:00+02:00");
  });

  it("klarar klockslag utan sekunder", () => {
    expect(stockholmEventISO("2026-10-06", "17:00")).toBe("2026-10-06T17:00+02:00");
  });

  it("returnerar bara datumet när klockslag saknas", () => {
    expect(stockholmEventISO("2026-10-06", null)).toBe("2026-10-06");
    expect(stockholmEventISO("2026-10-06")).toBe("2026-10-06");
  });

  it("bär ALLTID en zon när det finns ett klockslag", () => {
    for (const d of ["2026-01-05", "2026-04-01", "2026-07-15", "2026-12-24"]) {
      expect(stockholmEventISO(d, "19:30:00")).toMatch(/[+-]\d{2}:\d{2}$/);
    }
  });
});
