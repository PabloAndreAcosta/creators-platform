import { describe, it, expect } from "vitest";
import { isPassBooking, passRemaining, passBookingFields, redemptionSlice, pickOccurrence } from "../series-pass";

describe("klippkort på serie", () => {
  it("känner igen ett klippkort och räknar kvarvarande klipp", () => {
    expect(isPassBooking({ sessions_total: 5, sessions_redeemed: 2 })).toBe(true);
    expect(isPassBooking({ sessions_total: null, sessions_redeemed: null })).toBe(false);
    expect(passRemaining({ sessions_total: 5, sessions_redeemed: 2 })).toBe(3);
    expect(passRemaining({ sessions_total: 5, sessions_redeemed: 9 })).toBe(0);
  });

  it("ger bokningen klippkortsfält bara när kassan sålde ett kort", () => {
    expect(passBookingFields("5")).toEqual({ sessions_total: 5, sessions_redeemed: 0 });
    expect(passBookingFields("")).toEqual({});
    expect(passBookingFields(undefined)).toEqual({});
    expect(passBookingFields("0")).toEqual({});
  });

  it("delar kortets pris lika på tillfällena, inklusive avgift och avdrag", () => {
    expect(redemptionSlice({ amount_paid: 80000, platform_fee_amount: 8000, credit_applied_ore: 5000, sessions_total: 5 }))
      .toEqual({ amount_paid: 16000, platform_fee_amount: 1600, credit_applied_ore: 1000 });
    expect(redemptionSlice({ amount_paid: 1000, platform_fee_amount: null, sessions_total: 3 }))
      .toEqual({ amount_paid: 333, platform_fee_amount: null, credit_applied_ore: 0 });
  });

  const occ = (id: string, date: string) => ({ id, title: id, event_date: date, event_time: "17:00:00", event_location: null });

  it("hittar kvällens tillfälle i Stockholmstid och nästa kommande", () => {
    const list = [occ("a", "2026-09-14"), occ("b", "2026-09-21"), occ("c", "2026-09-07")];
    // Måndag 14 sep kl 22:00 svensk tid (20:00Z)
    const r = pickOccurrence(list, new Date("2026-09-14T20:00:00Z"));
    expect(r.today?.id).toBe("a");
    expect(r.next?.id).toBe("b");
  });

  it("räknar natten efter som samma kväll, och ingen kväll alls en tisdag", () => {
    const list = [occ("a", "2026-09-14"), occ("b", "2026-09-21")];
    // 00:30 svensk tid natten efter måndagen = 22:30Z söndag→måndag? Nej: 2026-09-14T22:30Z = 00:30 tisdag 15 sep.
    expect(pickOccurrence(list, new Date("2026-09-14T22:30:00Z")).today?.id).toBe("a");
    const tue = pickOccurrence(list, new Date("2026-09-15T18:00:00Z"));
    expect(tue.today).toBeNull();
    expect(tue.next?.id).toBe("b");
  });
});
