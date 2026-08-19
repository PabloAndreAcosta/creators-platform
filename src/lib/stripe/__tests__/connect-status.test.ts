import { describe, it, expect } from "vitest";
import { isConnectComplete } from "../connect-status";

describe("när en Connect-anslutning räknas som klar", () => {
  const complete = { connected: true, payoutsEnabled: true, cardPaymentsEnabled: true };

  it("klar när allt tre är på plats", () => {
    expect(isConnectComplete(complete)).toBe(true);
  });

  it("INTE klar utan kortbetalning", () => {
    // The regression this exists for: an account that could receive payouts but
    // had no card_payments capability reported "all set", which hid the guide —
    // and with it the only button that requests that capability — while the
    // onboarding checklist went on asking for the step.
    expect(isConnectComplete({ ...complete, cardPaymentsEnabled: false })).toBe(false);
    expect(isConnectComplete({ connected: true, payoutsEnabled: true })).toBe(false);
  });

  it("inte klar utan utbetalningar eller anslutning", () => {
    expect(isConnectComplete({ ...complete, payoutsEnabled: false })).toBe(false);
    expect(isConnectComplete({ ...complete, connected: false })).toBe(false);
  });

  it("inte klar när status saknas", () => {
    expect(isConnectComplete(null)).toBe(false);
    expect(isConnectComplete(undefined)).toBe(false);
    expect(isConnectComplete({})).toBe(false);
  });
});
