import { describe, it, expect } from "vitest";
import { buildShiftPayrollLine, shiftNetOre } from "../shift-pay";

describe("betalda pass", () => {
  const line = buildShiftPayrollLine({ signupId: "s", creatorId: "c", startsAt: "2026-11-12T20:00:00+01:00", payOre: 120_000, birthYear: 1990 });
  it("ingen moms och ingen provision — hela beloppet är lönebudget", () => {
    expect(line.vat_ore).toBe(0);
    expect(line.commission_ore).toBe(0);
    expect(line.labour_budget_ore).toBe(120_000);
  });
  it("summerar exakt som tabellens check kräver", () => {
    expect(line.vat_ore + line.commission_ore + line.gross_ore + line.employer_fee_ore + line.rounding_rest_ore).toBe(line.price_ore);
  });
  it("1 200 kr i kostnad ger ca 640 kr i handen, som kalkylen", () => {
    expect(Math.round(line.net_ore / 100)).toBe(640);
    expect(shiftNetOre(120_000, "2026-11-12", 1990)).toBe(line.net_ore);
  });
  it("lönen hör till dagen efter passet i Stockholm", () => {
    expect(line.pass_date).toBe("2026-11-12");
    expect(line.paid_on).toBe("2026-11-13");
  });
});
