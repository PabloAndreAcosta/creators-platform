import { describe, it, expect } from "vitest";
import { assertSection9Cleared, Section9NotClearedError, PAYMENTS_LIVE } from "../config";

describe("§9 legal gate", () => {
  it("blocks real-money operations while PAYMENTS_LIVE is false", () => {
    expect(PAYMENTS_LIVE).toBe(false);
    expect(() => assertSection9Cleared("payout.release")).toThrow(Section9NotClearedError);
  });
});
