import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { computeServiceFeeOre, serviceFeeMode } from "./service-fee";

describe("computeServiceFeeOre", () => {
  const prev = process.env.NEXT_PUBLIC_TICKET_SERVICE_FEE_ENABLED;
  afterEach(() => {
    process.env.NEXT_PUBLIC_TICKET_SERVICE_FEE_ENABLED = prev;
  });

  describe("when the flag is off", () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_TICKET_SERVICE_FEE_ENABLED = "false";
    });
    it("charges nothing regardless of price", () => {
      expect(computeServiceFeeOre(50000, 1)).toBe(0);
    });
  });

  describe("when the flag is on", () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_TICKET_SERVICE_FEE_ENABLED = "true";
    });

    it("is free for a 0 kr (gratis) ticket", () => {
      expect(computeServiceFeeOre(0, 1)).toBe(0);
    });

    it("hits the 3 kr floor on a cheap ticket (50 kr → 1.50 kr → floored to 3 kr)", () => {
      expect(computeServiceFeeOre(5000, 1)).toBe(300);
    });

    it("takes 3% in the middle band (200 kr → 6 kr)", () => {
      expect(computeServiceFeeOre(20000, 1)).toBe(600);
    });

    it("caps at 15 kr on an expensive ticket (1000 kr → 30 kr → capped to 15 kr)", () => {
      expect(computeServiceFeeOre(100000, 1)).toBe(1500);
    });

    it("charges the fee per ticket for multi-ticket orders", () => {
      expect(computeServiceFeeOre(20000, 3)).toBe(1800);
    });
  });
});

describe("serviceFeeMode", () => {
  it("defaults to buyer", () => {
    expect(serviceFeeMode(null)).toBe("buyer");
    expect(serviceFeeMode(undefined)).toBe("buyer");
    expect(serviceFeeMode("nonsense")).toBe("buyer");
  });
  it("honours an explicit absorb", () => {
    expect(serviceFeeMode("absorb")).toBe("absorb");
  });
});
