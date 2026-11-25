import { describe, it, expect } from "vitest";
import { DOOR_MARGIN_MINUTES, doorClosesAt, isEventDay, stockholmDay } from "../event-day";

// 2026-09-07 är sommartid: svensk tid = UTC + 2.
describe("isEventDay", () => {
  it("godkänner biljetten på eventdagen, svensk tid", () => {
    expect(isEventDay("2026-09-07", new Date("2026-09-07T15:00:00Z"))).toBe(true);
  });

  it("nekar en biljett för en annan dag — den 21:a på kvällen den 7:e", () => {
    expect(isEventDay("2026-09-21", new Date("2026-09-07T18:37:22Z"))).toBe(false);
  });

  // 22:30 UTC den 7:e är 00:30 den 8:e i Stockholm. Biljetten för den 7:e
  // ska hålla — kvällen pågår, bara UTC-dygnet har bytt.
  it("räknar Stockholm, inte UTC, runt midnatt", () => {
    expect(stockholmDay(new Date("2026-09-07T22:30:00Z"))).toBe("2026-09-08");
    expect(isEventDay("2026-09-07", new Date("2026-09-07T22:30:00Z"))).toBe(true);
  });

  it("släpper igenom när eventet saknar datum", () => {
    expect(isEventDay(null)).toBe(true);
  });

  it("marginalen är en timme", () => {
    expect(DOOR_MARGIN_MINUTES).toBe(60);
  });

  describe("utan sluttid: kvällen slutar vid midnatt, dörren kl. 01", () => {
    const ev = { event_time: "20:00" };
    it("00:59 släpper in", () => {
      expect(isEventDay("2026-09-07", new Date("2026-09-07T22:59:00Z"), ev)).toBe(true);
    });
    it("01:00 nekar", () => {
      expect(isEventDay("2026-09-07", new Date("2026-09-07T23:00:00Z"), ev)).toBe(false);
    });
    it("03:30 nekar — tidigare släpptes det in till 04", () => {
      expect(isEventDay("2026-09-07", new Date("2026-09-08T01:30:00Z"), ev)).toBe(false);
      expect(isEventDay("2026-09-07", new Date("2026-09-08T01:30:00Z"))).toBe(false);
    });
    it("stänger dörren exakt kl. 01 svensk tid", () => {
      expect(doorClosesAt({ event_date: "2026-09-07", ...ev })?.toISOString()).toBe("2026-09-07T23:00:00.000Z");
    });
  });

  describe("sluttid före midnatt: samma gräns som köpen (midnatt) + marginal", () => {
    const ev = { event_time: "19:00", event_end_time: "22:00" };
    it("00:30 släpper in, 01:00 nekar", () => {
      expect(isEventDay("2026-09-07", new Date("2026-09-07T22:30:00Z"), ev)).toBe(true);
      expect(isEventDay("2026-09-07", new Date("2026-09-07T23:00:00Z"), ev)).toBe(false);
    });
  });

  describe("kväll över midnatt, 21:00–02:00", () => {
    const ev = { event_time: "21:00:00", event_end_time: "02:00:00" };
    it("01:30 och 02:59 släpper in", () => {
      expect(isEventDay("2026-09-07", new Date("2026-09-07T23:30:00Z"), ev)).toBe(true);
      expect(isEventDay("2026-09-07", new Date("2026-09-08T00:59:00Z"), ev)).toBe(true);
    });
    it("03:00 nekar", () => {
      expect(isEventDay("2026-09-07", new Date("2026-09-08T01:00:00Z"), ev)).toBe(false);
    });
  });

  it("nästa dags biljett gäller redan på morgonen, som förut", () => {
    expect(isEventDay("2026-09-08", new Date("2026-09-07T22:30:00Z"))).toBe(true); // 00:30 den 8:e
  });

  it("räknar vintertid rätt (UTC + 1)", () => {
    // 2026-11-26: 00:30 svensk tid = 23:30Z den 25:e, 01:00 = 00:00Z den 26:e.
    expect(isEventDay("2026-11-25", new Date("2026-11-25T23:30:00Z"))).toBe(true);
    expect(isEventDay("2026-11-25", new Date("2026-11-26T00:00:00Z"))).toBe(false);
  });
});
