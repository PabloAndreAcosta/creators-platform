import { describe, expect, it } from "vitest";
import { parseRoleLabel, shiftRoleName } from "../roles";

describe("parseRoleLabel", () => {
  it("tomt eller saknat blir null", () => {
    expect(parseRoleLabel("")).toBeNull();
    expect(parseRoleLabel("   ")).toBeNull();
    expect(parseRoleLabel(null)).toBeNull();
  });
  it("trimmar och slår ihop mellanslag", () => {
    expect(parseRoleLabel("  DJ   värd ")).toBe("DJ värd");
  });
  it("kapar vid 40 tecken", () => {
    expect(parseRoleLabel("a".repeat(60))).toHaveLength(40);
  });
});

describe("shiftRoleName", () => {
  const t = (k: string) => `[${k}]`;
  it("eget namn går före rollens", () => {
    expect(shiftRoleName({ role: "helper", role_label: "Garderob" }, t)).toBe("Garderob");
  });
  it("utan eget namn visas rollens", () => {
    expect(shiftRoleName({ role: "door_host", role_label: null }, t)).toBe("[roles.door_host]");
  });
});
