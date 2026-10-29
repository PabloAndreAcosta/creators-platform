import { describe, it, expect } from "vitest";
import { defaultShifts, isValidShift, parseSlots } from "../shifts";

const ID = "4aed84c4-9e72-4a5f-a8cd-93e434577587";

describe("passtider", () => {
  it("godtar bara pass där slutet kommer efter starten", () => {
    expect(isValidShift({ start: "17:00", end: "19:00" })).toBe(true);
    expect(isValidShift({ start: "20:00", end: "19:00" })).toBe(false);
    expect(isValidShift({ start: "17:00", end: "" })).toBe(false);
  });

  it("utgår från hela kvällen när sluttiden finns", () => {
    expect(defaultShifts("17:00:00", "23:00:00")).toEqual([{ start: "17:00", end: "23:00" }]);
  });

  it("utgår från två timmar när sluttid saknas", () => {
    expect(defaultShifts("20:30", null)).toEqual([{ start: "20:30", end: "22:30" }]);
  });

  it("läser formulärets pass och säger nej till skräp", () => {
    expect(parseSlots(JSON.stringify([{ listing_id: ID, start: "17:00", end: "19:00" }]))).toEqual([
      { listing_id: ID, start: "17:00", end: "19:00" },
    ]);
    expect(parseSlots(JSON.stringify([{ listing_id: ID, start: "19:00", end: "17:00" }]))).toBeNull();
    expect(parseSlots(JSON.stringify([{ listing_id: "x", start: "17:00", end: "19:00" }]))).toBeNull();
    expect(parseSlots("[]")).toBeNull();
    expect(parseSlots("inte json")).toBeNull();
  });
});
