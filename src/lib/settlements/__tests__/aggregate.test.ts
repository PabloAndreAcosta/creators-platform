import { describe, it, expect } from "vitest";
import { aggregateEventBookings, type SettlementBookingRow } from "../aggregate";

const RATE = 0.1;
const row = (r: Partial<SettlementBookingRow>): SettlementBookingRow => ({
  status: "confirmed",
  amount_paid: 10_000,
  platform_fee_amount: null,
  refund_amount: null,
  guest_count: 1,
  ...r,
});

describe("aggregateEventBookings", () => {
  it("räknar sålda biljetter och brutto", () => {
    const t = aggregateEventBookings([row({}), row({ status: "completed" })], RATE);
    expect(t.ticketsSold).toBe(2);
    expect(t.grossOre).toBe(20_000);
  });

  it("drar av en återbetalning EN gång, inte två", () => {
    // Regressionen: två biljetter à 100 kr, en återbetald. Nettot ska vara
    // 100 kr minus avgiften. Tidigare saknades den återbetalda biljetten i
    // bruttot samtidigt som återbetalningen drogs av — den drog av sig själv
    // två gånger och nettot blev 100 kr för lågt.
    const t = aggregateEventBookings(
      [row({}), row({ status: "canceled", refund_amount: 10_000 })],
      RATE
    );

    expect(t.grossOre).toBe(20_000);
    expect(t.refundedOre).toBe(10_000);
    expect(t.grossOre - t.refundedOre - t.platformFeeOre).toBe(9_000);
  });

  it("tar inte avgift på det som återbetalats", () => {
    const t = aggregateEventBookings([row({ status: "canceled", refund_amount: 10_000 })], RATE);
    expect(t.platformFeeOre).toBe(0);
    expect(t.ticketsSold).toBe(0);
  });

  it("hanterar delvis återbetalning", () => {
    const t = aggregateEventBookings([row({ status: "canceled", refund_amount: 4_000 })], RATE);
    expect(t.grossOre).toBe(10_000);
    expect(t.refundedOre).toBe(4_000);
  });

  it("räknar inte avbokningar utan återbetalning", () => {
    // Gratisbiljett eller avbokning före betalning: inga pengar rörde sig.
    const t = aggregateEventBookings([row({ status: "canceled", refund_amount: null })], RATE);
    expect(t.grossOre).toBe(0);
    expect(t.refundedOre).toBe(0);
    expect(t.refundedCount).toBe(0);
  });

  it("föredrar sparad avgift framför uppskattning", () => {
    const t = aggregateEventBookings([row({ platform_fee_amount: 777 })], RATE);
    expect(t.platformFeeOre).toBe(777);
  });

  it("räknar flera gäster på en bokning", () => {
    const t = aggregateEventBookings([row({ guest_count: 4, amount_paid: 40_000 })], RATE);
    expect(t.ticketsSold).toBe(4);
    expect(t.grossOre).toBe(40_000);
  });

  it("klarar en tom kväll", () => {
    const t = aggregateEventBookings([], RATE);
    expect(t).toEqual({ ticketsSold: 0, grossOre: 0, platformFeeOre: 0, refundedOre: 0, refundedCount: 0 });
  });
});
