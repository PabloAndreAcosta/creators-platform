import { describe, it, expect } from "vitest";
import { splitEventRevenue, formatOre } from "../split";

const VAT_25 = 0.25;

describe("splitEventRevenue", () => {
  it("delar en enkel kväll rätt", () => {
    // 10 biljetter à 125 kr = 1250 kr inkl moms → 1000 kr netto → 500/500.
    const s = splitEventRevenue({ grossOre: 125_000, vatRate: VAT_25, partnerPercent: 50 });

    expect(s.vatOre).toBe(25_000);
    expect(s.basisOre).toBe(100_000);
    expect(s.partnerOre).toBe(50_000);
    expect(s.organiserOre).toBe(50_000);
  });

  it("räknar moms UR priset, inte ovanpå", () => {
    // Biljettpriser mot konsument anges inklusive moms. 125 med 25 % är
    // 100 + 25, inte 125 + 31,25.
    const s = splitEventRevenue({ grossOre: 12_500, vatRate: VAT_25, partnerPercent: 50 });
    expect(s.vatOre).toBe(2_500);
    expect(s.basisOre).toBe(10_000);
  });

  it("drar av återbetalningar före delningen", () => {
    // En av tio biljetter återbetald → underlaget är nio.
    const s = splitEventRevenue({
      grossOre: 125_000,
      refundedOre: 12_500,
      vatRate: VAT_25,
      partnerPercent: 50,
    });

    expect(s.netInclVatOre).toBe(112_500);
    expect(s.partnerOre).toBe(45_000);
    expect(s.organiserOre).toBe(45_000);
  });

  it("ger noll åt båda när kvällen ställs in", () => {
    // Allt återbetalt: ingen andel utgår, precis som avtalet säger.
    const s = splitEventRevenue({
      grossOre: 125_000,
      refundedOre: 125_000,
      vatRate: VAT_25,
      partnerPercent: 50,
    });

    expect(s.basisOre).toBe(0);
    expect(s.partnerOre).toBe(0);
    expect(s.organiserOre).toBe(0);
  });

  it("går inte under noll om återbetalningarna överstiger intäkten", () => {
    // Kan inträffa när en biljett från en tidigare kväll återbetalas sent.
    // Ett negativt underlag hade vänt överföringen åt fel håll.
    const s = splitEventRevenue({
      grossOre: 10_000,
      refundedOre: 25_000,
      vatRate: VAT_25,
      partnerPercent: 50,
    });

    expect(s.netInclVatOre).toBe(0);
    expect(s.partnerOre).toBe(0);
    expect(s.organiserOre).toBe(0);
  });

  it("tappar aldrig ett öre vid avrundning", () => {
    // Delarna måste summera exakt till underlaget, annars stämmer varken
    // Stripe-överföringen eller bokföringen. Udda belopp är det svåra fallet.
    for (const gross of [1, 3, 7, 99, 101, 12_345, 99_999, 1_000_001]) {
      const s = splitEventRevenue({ grossOre: gross, vatRate: VAT_25, partnerPercent: 50 });
      expect(s.partnerOre + s.organiserOre).toBe(s.basisOre);
      expect(s.vatOre + s.basisOre).toBe(s.netInclVatOre);
    }
  });

  it("låter arrangören få resten vid udda ören", () => {
    // 1 öre kan inte delas i två. Partnern avrundas nedåt.
    const s = splitEventRevenue({ grossOre: 1, vatRate: 0, partnerPercent: 50 });
    expect(s.basisOre).toBe(1);
    expect(s.partnerOre).toBe(0);
    expect(s.organiserOre).toBe(1);
  });

  it("hanterar andra procentsatser än femtio", () => {
    const s = splitEventRevenue({ grossOre: 100_000, vatRate: 0, partnerPercent: 30 });
    expect(s.partnerOre).toBe(30_000);
    expect(s.organiserOre).toBe(70_000);
  });

  it("hanterar annan momssats", () => {
    // 6 % är satsen för vissa kulturevenemang. Vilken sats som gäller entré
    // till dansevenemang avgörs av revisor — koden tar den som parameter.
    const s = splitEventRevenue({ grossOre: 106_000, vatRate: 0.06, partnerPercent: 50 });
    expect(s.vatOre).toBe(6_000);
    expect(s.basisOre).toBe(100_000);
  });

  it("avvisar orimliga indata i stället för att räkna fel", () => {
    expect(() => splitEventRevenue({ grossOre: -1, vatRate: 0.25, partnerPercent: 50 })).toThrow();
    expect(() => splitEventRevenue({ grossOre: 100, vatRate: 25, partnerPercent: 50 })).toThrow();
    expect(() => splitEventRevenue({ grossOre: 100, vatRate: 0.25, partnerPercent: 101 })).toThrow();
  });
});

describe("formatOre", () => {
  it("visar öre som kronor med två decimaler", () => {
    expect(formatOre(50_000)).toMatch(/^500,00 kr$/);
    expect(formatOre(1)).toBe("0,01 kr");
  });
});
