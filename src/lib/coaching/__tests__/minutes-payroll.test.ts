import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));

import { redeemedPriceKr } from "../minutes-payroll";

describe("redeemedPriceKr – lönen följer inlösta minuter", () => {
  it("inget inlöst ger ingen lön", () => {
    expect(redeemedPriceKr(60000, 60, 0)).toBe(0);
  });
  it("halva timmen inlöst ger halva beloppet", () => {
    expect(redeemedPriceKr(60000, 60, 30)).toBe(300);
  });
  it("allt inlöst ger hela beloppet", () => {
    expect(redeemedPriceKr(45000, 45, 45)).toBe(450);
  });
  it("aldrig mer än det som betalats", () => {
    expect(redeemedPriceKr(30000, 30, 45)).toBe(300);
  });
  it("obetald bokning ger ingen lön", () => {
    expect(redeemedPriceKr(0, 60, 60)).toBe(0);
  });
});
