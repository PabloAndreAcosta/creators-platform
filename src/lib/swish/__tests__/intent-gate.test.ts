import { describe, it, expect } from "vitest";
import { swishIntentGate } from "../intent-gate";
import { checkinButtonMode } from "@/lib/tickets/evening";

// Torsdag 2026-11-26, vintertid (UTC + 1). Kväll 20:00, ingen sluttid.
const base = { price: 200, event_date: "2026-11-26", event_time: "20:00:00" };

describe("swishIntentGate — samma köpgräns som kortkassan", () => {
  it("släpper igenom en kommande kväll till ordinarie pris", () => {
    expect(swishIntentGate(base, new Date("2026-11-25T12:00:00Z"))).toEqual({ ok: true, price: 200 });
  });

  it("släpper igenom medan kvällen pågår, även 23:59", () => {
    expect(swishIntentGate(base, new Date("2026-11-26T22:59:00Z")).ok).toBe(true);
  });

  it("nekar efter midnatt — kvällen har passerat", () => {
    expect(swishIntentGate(base, new Date("2026-11-26T23:00:00Z"))).toEqual({ ok: false, status: 403, code: "past" });
  });

  it("nekar en passerad kväll även inom efterköpsfönstret: \"Var du där?\" går bara med kort", () => {
    const now = new Date("2026-11-27T09:00:00Z");
    expect(checkinButtonMode(now, base)).toBe("wasThere");
    expect(swishIntentGate(base, now)).toMatchObject({ ok: false, code: "past" });
  });

  it("följer sluttiden över midnatt (21:00–02:00)", () => {
    const ev = { ...base, event_time: "21:00", event_end_time: "02:00" };
    expect(swishIntentGate(ev, new Date("2026-11-27T00:30:00Z")).ok).toBe(true); // 01:30
    expect(swishIntentGate(ev, new Date("2026-11-27T01:00:00Z"))).toMatchObject({ ok: false, code: "past" }); // 02:00
  });

  it("nekar slutsålt", () => {
    expect(swishIntentGate({ ...base, capacity: 10, tickets_sold: 10 }, new Date("2026-11-25T12:00:00Z"))).toMatchObject({
      ok: false,
      code: "soldOut",
    });
  });

  it("nekar före släppet", () => {
    expect(
      swishIntentGate({ ...base, public_sale_at: "2026-11-26T08:00:00Z" }, new Date("2026-11-25T12:00:00Z"))
    ).toMatchObject({ ok: false, code: "notReleased" });
  });

  it("tar förköpspriset under förköpet, som kortkassan", () => {
    const ev = {
      ...base,
      early_bird_start: "2026-11-20T00:00:00Z",
      early_bird_end: "2026-11-26T00:00:00Z",
      early_bird_price: 150,
      public_sale_at: "2026-11-26T00:00:00Z",
    };
    expect(swishIntentGate(ev, new Date("2026-11-25T12:00:00Z"))).toEqual({ ok: true, price: 150 });
    expect(swishIntentGate(ev, new Date("2026-11-26T12:00:00Z"))).toEqual({ ok: true, price: 200 });
  });
});
