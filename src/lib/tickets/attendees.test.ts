import { describe, it, expect } from "vitest";
import {
  clampQuantity,
  sanitizeAttendeeName,
  attendeeNamesToMeta,
  attendeeNamesFromMeta,
  MAX_TICKETS_PER_ORDER,
} from "./attendees";

describe("clampQuantity", () => {
  it("floors invalid/low values to 1", () => {
    expect(clampQuantity(undefined)).toBe(1);
    expect(clampQuantity(0)).toBe(1);
    expect(clampQuantity(-3)).toBe(1);
    expect(clampQuantity("2")).toBe(2);
  });
  it("caps at the max per order", () => {
    expect(clampQuantity(50)).toBe(MAX_TICKETS_PER_ORDER);
  });
});

describe("sanitizeAttendeeName", () => {
  it("trims and returns null for blank", () => {
    expect(sanitizeAttendeeName("  ")).toBeNull();
    expect(sanitizeAttendeeName(null)).toBeNull();
    expect(sanitizeAttendeeName("  Anna  ")).toBe("Anna");
  });
  it("clips to 60 chars", () => {
    expect(sanitizeAttendeeName("x".repeat(80))?.length).toBe(60);
  });
});

describe("attendee names metadata round-trip", () => {
  it("serializes and parses names back, padding to qty", () => {
    const meta = attendeeNamesToMeta(["Anna", "Erik"], 2);
    expect(attendeeNamesFromMeta(meta)).toEqual(["Anna", "Erik"]);
  });
  it("returns '' when all names are blank", () => {
    expect(attendeeNamesToMeta(["", "  "], 2)).toBe("");
    expect(attendeeNamesFromMeta("")).toEqual([]);
  });
  it("only keeps up to qty names", () => {
    const meta = attendeeNamesToMeta(["A", "B", "C"], 2);
    expect(attendeeNamesFromMeta(meta)).toEqual(["A", "B"]);
  });
  it("fits 10 first names comfortably under the 500-char cap", () => {
    const names = Array.from({ length: 10 }, (_, i) => `Namnsson${i}`);
    const meta = attendeeNamesToMeta(names, 10);
    expect(meta.length).toBeLessThanOrEqual(450);
    expect(attendeeNamesFromMeta(meta)).toHaveLength(10);
  });
  it("falls back to '' if the payload would overflow", () => {
    const huge = Array.from({ length: 10 }, () => "x".repeat(60));
    expect(attendeeNamesToMeta(huge, 10)).toBe("");
  });
  it("parses garbage safely", () => {
    expect(attendeeNamesFromMeta("{not json")).toEqual([]);
  });
});
