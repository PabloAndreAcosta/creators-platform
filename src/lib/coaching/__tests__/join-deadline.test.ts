import { describe, it, expect } from "vitest";
import { instructorJoinDeadline, instructorJoinOpen } from "../join-deadline";

describe("instructorJoinDeadline", () => {
  it("är måndagen samma vecka", () => {
    expect(instructorJoinDeadline("2026-11-05")).toBe("2026-11-02"); // torsdag
    expect(instructorJoinDeadline("2026-11-08")).toBe("2026-11-02"); // söndag
    expect(instructorJoinDeadline("2026-11-02")).toBe("2026-11-02"); // måndag
  });

  it("går över månads- och årsskifte", () => {
    expect(instructorJoinDeadline("2026-10-01")).toBe("2026-09-28");
    expect(instructorJoinDeadline("2027-01-01")).toBe("2026-12-28");
  });

  it("påverkas inte av sommartidens slut", () => {
    expect(instructorJoinDeadline("2026-10-29")).toBe("2026-10-26");
  });
});

describe("instructorJoinOpen", () => {
  it("öppet till och med måndagen, stängt från tisdag", () => {
    expect(instructorJoinOpen("2026-11-05", "2026-10-30")).toBe(true);
    expect(instructorJoinOpen("2026-11-05", "2026-11-02")).toBe(true);
    expect(instructorJoinOpen("2026-11-05", "2026-11-03")).toBe(false);
    expect(instructorJoinOpen("2026-11-05", "2026-11-05")).toBe(false);
  });
});
