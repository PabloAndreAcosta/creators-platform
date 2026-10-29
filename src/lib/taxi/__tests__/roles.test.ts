import { describe, it, expect } from "vitest";
import { volunteerRoleAllowed } from "../roles";

describe("DJ-pass", () => {
  it("obetald DJ bara på practica, betald DJ alltid", () => {
    expect(volunteerRoleAllowed("dj", { is_practica: true })).toBe(true);
    expect(volunteerRoleAllowed("dj", { is_practica: false })).toBe(false);
    expect(volunteerRoleAllowed("dj", { is_practica: false }, 120_000)).toBe(true);
    expect(volunteerRoleAllowed("taxi_dancer", { is_practica: false })).toBe(true);
  });
});
