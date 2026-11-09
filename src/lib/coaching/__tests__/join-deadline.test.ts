import { describe, it, expect } from "vitest";
import { instructorJoinDeadline, instructorJoinOpen } from "../join-deadline";

describe("instructorJoinDeadline", () => {
  it("är kvällens egen dag", () => {
    expect(instructorJoinDeadline("2026-11-12")).toBe("2026-11-12");
    expect(instructorJoinDeadline("2027-01-01")).toBe("2027-01-01");
  });
});

describe("instructorJoinOpen", () => {
  it("öppet till och med kvällens dag, stängt dagen efter", () => {
    expect(instructorJoinOpen("2026-11-12", "2026-11-09")).toBe(true); // måndag samma vecka
    expect(instructorJoinOpen("2026-11-12", "2026-11-11")).toBe(true); // onsdag — stängt förr
    expect(instructorJoinOpen("2026-11-12", "2026-11-12")).toBe(true); // samma torsdag
    expect(instructorJoinOpen("2026-11-12", "2026-11-13")).toBe(false);
  });
});
