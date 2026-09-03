import { describe, it, expect } from "vitest";
import { validateShareInput } from "../share-input";

const ok = (o: Record<string, unknown>) => validateShareInput({ partnerPercent: 50, vatRate: 25, payoutDelayDays: 1, ...o });

describe("validateShareInput", () => {
  it("godkänner ett vanligt avtal och räknar om momsen till decimal", () => {
    const r = ok({});
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ partnerPercent: 50, vatRate: 0.25, payoutDelayDays: 1 });
  });

  it("tolkar moms som PROCENT, inte decimal", () => {
    // Skriver någon 25 ska det bli 0.25. Hade fältet tagit decimaler skulle
    // en 25:a ge tjugofem gånger för mycket moms avdraget.
    const r = ok({ vatRate: 6 });
    if (r.ok) expect(r.value.vatRate).toBe(0.06);
  });

  it("avvisar procent utanför 0–100", () => {
    expect(ok({ partnerPercent: 101 }).ok).toBe(false);
    expect(ok({ partnerPercent: -1 }).ok).toBe(false);
  });

  it("tillåter 0 och 100 procent", () => {
    // 0 % är ett giltigt avtal under en uppstartsperiod, 100 % likaså.
    expect(ok({ partnerPercent: 0 }).ok).toBe(true);
    expect(ok({ partnerPercent: 100 }).ok).toBe(true);
  });

  it("avvisar procent som inte är heltal", () => {
    // Halva procent är inget avtal någon skriver, och det gör bara
    // avrundningen otydligare.
    expect(ok({ partnerPercent: 33.5 }).ok).toBe(false);
  });

  it("avvisar orimlig moms", () => {
    expect(ok({ vatRate: 100 }).ok).toBe(false);
    expect(ok({ vatRate: -1 }).ok).toBe(false);
  });

  it("avvisar orimlig fördröjning", () => {
    expect(ok({ payoutDelayDays: -1 }).ok).toBe(false);
    expect(ok({ payoutDelayDays: 31 }).ok).toBe(false);
    expect(ok({ payoutDelayDays: 1.5 }).ok).toBe(false);
  });

  it("tillåter utbetalning samma dag", () => {
    expect(ok({ payoutDelayDays: 0 }).ok).toBe(true);
  });

  it("avvisar skräp i stället för att tolka det välvilligt", () => {
    expect(ok({ partnerPercent: "femtio" }).ok).toBe(false);
    expect(ok({ vatRate: null }).ok).toBe(false);
    expect(ok({ payoutDelayDays: undefined }).ok).toBe(false);
  });

  it("avrundar momsen till kolumnens precision", () => {
    const r = ok({ vatRate: 8.25 });
    if (r.ok) expect(r.value.vatRate).toBe(0.083);
  });
});

describe("tomt är inte noll", () => {
  it("avvisar tomt momsfält i stället för att räkna 0 % moms", () => {
    // Utan det här hade ett tomt fält gett partnern en större andel än avsett,
    // eftersom hela beloppet räknats som momsfritt underlag.
    expect(validateShareInput({ partnerPercent: 50, vatRate: "", payoutDelayDays: 1 }).ok).toBe(false);
    expect(validateShareInput({ partnerPercent: 50, vatRate: null, payoutDelayDays: 1 }).ok).toBe(false);
  });

  it("avvisar tom procent", () => {
    expect(validateShareInput({ partnerPercent: "", vatRate: 25, payoutDelayDays: 1 }).ok).toBe(false);
  });

  it("men noll som faktiskt ANGES är giltigt", () => {
    const r = validateShareInput({ partnerPercent: 50, vatRate: 0, payoutDelayDays: 0 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.vatRate).toBe(0);
  });
});
