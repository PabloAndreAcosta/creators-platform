import { describe, it, expect, afterEach, vi } from "vitest";
import { canReceivePayments } from "../beta-gate";

const OWNER_ID = "15d852ed-1f33-446f-9bcb-821c2444c84f"; // pablo.acosta@usha.se (default owner)
const iso = "2026-06-18T00:00:00Z";

afterEach(() => vi.unstubAllEnvs());

describe("beta payment gate", () => {
  it("allows the platform owner", () => {
    expect(canReceivePayments({ id: OWNER_ID, company_verified_at: null })).toBe(true);
  });

  it("allows a verified company", () => {
    expect(canReceivePayments({ id: "someone-else", company_verified_at: iso })).toBe(true);
  });

  it("blocks an unverified private individual during beta", () => {
    expect(canReceivePayments({ id: "someone-else", company_verified_at: null })).toBe(false);
  });

  it("blocks a missing payee", () => {
    expect(canReceivePayments(null)).toBe(false);
    expect(canReceivePayments(undefined)).toBe(false);
  });

  it("opens to everyone once beta is over (NEXT_PUBLIC_PAYMENTS_OPEN=true)", () => {
    vi.stubEnv("NEXT_PUBLIC_PAYMENTS_OPEN", "true");
    expect(canReceivePayments({ id: "someone-else", company_verified_at: null })).toBe(true);
  });
});
