import { describe, it, expect, afterEach, vi } from "vitest";
import { canReceivePayments } from "../beta-gate";
import { resolvePayeeFlow } from "@/lib/stripe/checkout";

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

/**
 * Two independent mechanisms answer "is this Usha's own account?":
 *
 *   canReceivePayments()  — the legal gate. Reads OWNER_PAYEE_IDS only.
 *   resolvePayeeFlow()    — gross vs net. Reads is_usha_owned_seller OR the list.
 *
 * The asymmetry is deliberate: a database flag must not be able to open the
 * payment gate, so that DB access alone can never route money to a new payee.
 *
 * These tests pin the current behaviour and, more importantly, document the
 * trap below in a place a developer actually reads. They cannot detect every
 * future refactor of the gate — a widened PayeeEligibility would still satisfy
 * them — so treat the second test as an executable note, not a guard rail.
 */
describe("owner list vs is_usha_owned_seller", () => {
  const base = {
    stripe_account_id: "acct_test",
    card_payments_enabled: false,
    company_name: null,
    org_number: null,
    full_name: null,
  };

  it("both mechanisms agree for the default owner", () => {
    expect(canReceivePayments({ id: OWNER_ID, company_verified_at: null })).toBe(true);
    expect(resolvePayeeFlow({ ...base, id: OWNER_ID, is_usha_owned_seller: true })).toBe(
      "usha_principal"
    );
  });

  it("is_usha_owned_seller alone routes the flow but does NOT open the gate", () => {
    // The silent trap: flagging a second Usha profile in the database gives it
    // the gross flow, yet the gate still blocks it. Selling would fail with no
    // obvious cause — the flag looks right. Such a profile needs the owner list
    // or a verified company too.
    const payee = { ...base, id: "second-usha-profile", is_usha_owned_seller: true };

    expect(resolvePayeeFlow(payee)).toBe("usha_principal");
    expect(canReceivePayments({ id: payee.id, company_verified_at: null })).toBe(false);
  });
});
