import { describe, it, expect } from "vitest";
import { creatorBalance, type EarningEntry } from "../creator-balance";

const intjanat = (kr: number, betald = false): EarningEntry => ({
  amount_ore: kr * 100,
  paid_at: betald ? "2026-10-05T00:00:00Z" : null,
});

describe("creatorBalance", () => {
  it("räknar intjänat, utbetalt och kvar", () => {
    const b = creatorBalance([intjanat(368), intjanat(200, true)]);
    expect(b.earnedOre).toBe(56800);
    expect(b.paidOre).toBe(20000);
    expect(b.unpaidOre).toBe(36800);
    expect(b.payableOre).toBe(36800);
  });

  it("drar av en skuld från det som ska betalas ut", () => {
    const b = creatorBalance([intjanat(368)], [{ amount_ore: 10000 }]);
    expect(b.debtOre).toBe(10000);
    expect(b.payableOre).toBe(26800);
    // Det intjänade ändras inte av att en skuld finns — den syns för sig.
    expect(b.unpaidOre).toBe(36800);
  });

  it("en skuld större än saldot ger noll att betala, inte minus", () => {
    // En negativ utbetalning finns inte. Resten ligger kvar som skuld.
    const b = creatorBalance([intjanat(100)], [{ amount_ore: 50000 }]);
    expect(b.payableOre).toBe(0);
    expect(b.debtOre).toBe(50000);
  });

  it("allt utbetalt ger noll kvar", () => {
    const b = creatorBalance([intjanat(368, true)]);
    expect(b.unpaidOre).toBe(0);
    expect(b.payableOre).toBe(0);
  });

  it("tomt är noll rakt igenom", () => {
    expect(creatorBalance([])).toEqual({
      earnedOre: 0, paidOre: 0, unpaidOre: 0, debtOre: 0, payableOre: 0,
    });
  });
});
