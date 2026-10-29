import { describe, expect, it } from "vitest";
import { matchesInstructor, parseCoachingFormats, parseCoachingTitle, type InstructorRow } from "../instructors";

const row = (over: Partial<InstructorRow> = {}): InstructorRow => ({
  id: "1",
  slug: null,
  full_name: "Ana Ruiz",
  avatar_url: null,
  coaching_title: "Coach",
  coaching_bio: "Teknik och musikalitet",
  coaching_hourly_rate_sek: 600,
  coaching_specialties: ["Kizomba"],
  coaching_formats: ["in_person"],
  dance_styles: ["Urban kiz"],
  dance_languages: ["Svenska", "Spanska"],
  locations: ["Stockholm"],
  location: null,
  ...over,
});

describe("parseCoachingTitle", () => {
  it("tomt blir null, mellanslag slås ihop, max 40", () => {
    expect(parseCoachingTitle("  ")).toBeNull();
    expect(parseCoachingTitle(" Personlig   tränare ")).toBe("Personlig tränare");
    expect(parseCoachingTitle("x".repeat(50))).toHaveLength(40);
  });
});

describe("parseCoachingFormats", () => {
  it("släpper bara igenom kända format", () => {
    expect(parseCoachingFormats(["online", "zoom", "in_person"])).toEqual(["in_person", "online"]);
    expect(parseCoachingFormats("online")).toEqual([]);
  });
});

describe("matchesInstructor", () => {
  it("söker i titel, inriktning och stilar utan skiftlägeskänslighet", () => {
    expect(matchesInstructor(row(), { q: "kizomba" })).toBe(true);
    expect(matchesInstructor(row(), { q: "urban" })).toBe(true);
    expect(matchesInstructor(row(), { q: "coach" })).toBe(true);
    expect(matchesInstructor(row(), { q: "salsa" })).toBe(false);
  });
  it("stad, språk och maxpris", () => {
    expect(matchesInstructor(row(), { city: "stockholm" })).toBe(true);
    expect(matchesInstructor(row(), { city: "Göteborg" })).toBe(false);
    expect(matchesInstructor(row(), { language: "spanska" })).toBe(true);
    expect(matchesInstructor(row(), { maxRate: 500 })).toBe(false);
    expect(matchesInstructor(row({ coaching_hourly_rate_sek: null }), { maxRate: 500 })).toBe(true);
  });
  it("utan angivet format visas instruktören för båda", () => {
    expect(matchesInstructor(row(), { format: "online" })).toBe(false);
    expect(matchesInstructor(row({ coaching_formats: null }), { format: "online" })).toBe(true);
  });
});
