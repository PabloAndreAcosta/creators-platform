import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { computeServiceFeeOre, serviceFeeMode, serviceFeeLabel, TICKET_SERVICE_FEE } from "./service-fee";

describe("computeServiceFeeOre", () => {
  const prev = process.env.NEXT_PUBLIC_TICKET_SERVICE_FEE_ENABLED;
  afterEach(() => {
    process.env.NEXT_PUBLIC_TICKET_SERVICE_FEE_ENABLED = prev;
  });

  describe("kill switch", () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_TICKET_SERVICE_FEE_ENABLED = "false";
    });
    it("tar inget även när arrangören valt att köparen betalar", () => {
      expect(computeServiceFeeOre(50000, 1, "buyer")).toBe(0);
    });
  });

  describe("påslagen (standard)", () => {
    beforeEach(() => {
      delete process.env.NEXT_PUBLIC_TICKET_SERVICE_FEE_ENABLED;
    });

    it("är 0 när arrangören inte valt att köparen betalar", () => {
      expect(computeServiceFeeOre(13000, 1)).toBe(0);
      expect(computeServiceFeeOre(13000, 1, "absorb")).toBe(0);
    });

    it("är 0 på en gratisbiljett", () => {
      expect(computeServiceFeeOre(0, 1, "buyer")).toBe(0);
    });

    it("tar 2 % + 2,50 kr på ett köp (130 kr → 2,60 + 2,50 = 5,10 kr)", () => {
      expect(computeServiceFeeOre(13000, 1, "buyer")).toBe(510);
    });

    it("tar den fasta delen EN gång per köp, inte per biljett (3 × 200 kr → 12 + 2,50)", () => {
      expect(computeServiceFeeOre(20000, 3, "buyer")).toBe(1450);
    });

    it("täcker Stripes kortkostnad (1,5 % + 1,80 kr) efter 25 % moms på vår medianbiljett", () => {
      const fee = computeServiceFeeOre(12500, 1, "buyer");
      const stripe = 12500 * 0.015 + 180;
      expect(fee / 1.25).toBeGreaterThanOrEqual(stripe);
    });
  });
});

describe("serviceFeeMode", () => {
  it("saknas värde gäller ingen avgift", () => {
    expect(serviceFeeMode(null)).toBe("absorb");
    expect(serviceFeeMode(undefined)).toBe("absorb");
    expect(serviceFeeMode("nonsense")).toBe("absorb");
  });
  it("respekterar ett uttryckligt val att köparen betalar", () => {
    expect(serviceFeeMode("buyer")).toBe("buyer");
  });
});

describe("serviceFeeLabel", () => {
  it("skriver satsen på svenskt vis och matchar konstanterna", () => {
    expect(serviceFeeLabel()).toBe("2 % + 2,50 kr");
    expect(TICKET_SERVICE_FEE.rate).toBe(0.02);
    expect(TICKET_SERVICE_FEE.fixedOre).toBe(250);
  });
});
