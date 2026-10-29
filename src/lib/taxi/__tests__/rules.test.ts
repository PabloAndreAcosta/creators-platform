import { describe, it, expect } from "vitest";
import {
  validateShift, cancelDeadline, isLateCancel, isStrike, strikeCount, isBlocked,
  canCheckIn, canCheckOut, workedMinutes, isShort, ageOn,
} from "../rules";

const shift = { starts_at: "2026-11-12T19:00:00+01:00", ends_at: "2026-11-12T21:00:00+01:00" };

describe("validateShift", () => {
  const base = { eventDate: "2026-11-12", capacity: 4 };
  it("godkänner två timmar inom 17–23", () => {
    const r = validateShift({ ...base, startTime: "17:00", endTime: "19:00" });
    expect(r).toEqual({ ok: true, startsAt: "2026-11-12T17:00:00+01:00", endsAt: "2026-11-12T19:00:00+01:00" });
  });
  it("vägrar kortare än två timmar", () => {
    expect(validateShift({ ...base, startTime: "19:00", endTime: "20:30" })).toEqual({ ok: false, error: "length" });
  });
  it("vägrar utanför 17–23", () => {
    expect(validateShift({ ...base, startTime: "16:30", endTime: "19:00" })).toEqual({ ok: false, error: "window" });
    expect(validateShift({ ...base, startTime: "21:30", endTime: "23:30" })).toEqual({ ok: false, error: "window" });
  });
  it("vägrar sluttid före start och konstiga tider", () => {
    expect(validateShift({ ...base, startTime: "21:00", endTime: "19:00" })).toEqual({ ok: false, error: "length" });
    expect(validateShift({ ...base, startTime: "7pm", endTime: "21:00" })).toEqual({ ok: false, error: "time" });
  });
  it("vägrar noll platser", () => {
    expect(validateShift({ ...base, capacity: 0, startTime: "17:00", endTime: "19:00" })).toEqual({ ok: false, error: "capacity" });
  });
  it("räknar sommartid rätt", () => {
    const r = validateShift({ ...base, eventDate: "2026-06-11", startTime: "17:00", endTime: "19:00" });
    expect(r.ok && r.startsAt).toBe("2026-06-11T17:00:00+02:00");
  });
});

describe("avbokning", () => {
  it("fristen är när kvällens datum börjar i Stockholm", () => {
    expect(cancelDeadline("2026-11-12")).toBe("2026-11-12T00:00:00+01:00");
  });
  it("23.59 dagen före är i tid, 00.00 samma dag är sent", () => {
    expect(isLateCancel("2026-11-12", new Date("2026-11-11T22:59:00Z"))).toBe(false);
    expect(isLateCancel("2026-11-12", new Date("2026-11-11T23:00:00Z"))).toBe(true);
  });
});

describe("varningar", () => {
  const now = new Date("2026-11-13T12:00:00Z");
  const booked = { status: "booked" as const, late_cancel: false, checked_in_at: null, ends_at: shift.ends_at };
  it("uteblivet pass och sen avbokning ger varning, i tid avbokat gör det inte", () => {
    expect(isStrike(booked, now)).toBe(true);
    expect(isStrike({ ...booked, checked_in_at: shift.starts_at }, now)).toBe(false);
    expect(isStrike({ ...booked, status: "cancelled", late_cancel: true }, now)).toBe(true);
    expect(isStrike({ ...booked, status: "cancelled", late_cancel: false }, now)).toBe(false);
  });
  it("ett pass som inte är slut än är ingen varning", () => {
    expect(isStrike(booked, new Date("2026-11-12T19:30:00Z"))).toBe(false);
  });
  it("tre varningar spärrar", () => {
    expect(strikeCount([booked, booked], now)).toBe(2);
    expect(isBlocked([booked, booked], now)).toBe(false);
    expect(isBlocked([booked, booked, booked], now)).toBe(true);
  });
});

describe("in- och utcheckning", () => {
  it("incheckning öppnar 30 minuter före och stänger vid passets slut", () => {
    expect(canCheckIn(shift, new Date("2026-11-12T17:29:00Z"))).toBe(false);
    expect(canCheckIn(shift, new Date("2026-11-12T17:30:00Z"))).toBe(true);
    expect(canCheckIn(shift, new Date("2026-11-12T20:01:00Z"))).toBe(false);
  });
  it("utcheckning kräver incheckning och går upp till en timme efter", () => {
    const s = { checked_in_at: "2026-11-12T18:00:00Z", checked_out_at: null };
    expect(canCheckOut({ ...s, checked_in_at: null }, shift, new Date("2026-11-12T19:00:00Z"))).toBe(false);
    expect(canCheckOut(s, shift, new Date("2026-11-12T21:00:00Z"))).toBe(true);
    expect(canCheckOut(s, shift, new Date("2026-11-12T21:01:00Z"))).toBe(false);
  });
  it("arbetad tid räknas inom passet och korta pass flaggas", () => {
    const full = { checked_in_at: "2026-11-12T17:50:00Z", checked_out_at: "2026-11-12T20:10:00Z" };
    expect(workedMinutes(full, shift)).toBe(120);
    expect(isShort(full, shift)).toBe(false);
    const kort = { checked_in_at: "2026-11-12T18:00:00Z", checked_out_at: "2026-11-12T19:00:00Z" };
    expect(workedMinutes(kort, shift)).toBe(60);
    expect(isShort(kort, shift)).toBe(true);
    expect(isShort({ checked_in_at: "2026-11-12T18:00:00Z", checked_out_at: "2026-11-12T19:46:00Z" }, shift)).toBe(false);
  });
});

describe("ageOn", () => {
  it("räknar ålder på kvällens datum", () => {
    expect(ageOn("20081112-1234", "2026-11-12")).toBe(18);
    expect(ageOn("20081113-1234", "2026-11-12")).toBe(17);
    expect(ageOn("200811121234", "2026-11-12")).toBe(18);
  });
  it("samordningsnummer och okänt format", () => {
    expect(ageOn("20081172-1234", "2026-11-12")).toBe(18);
    expect(ageOn(null, "2026-11-12")).toBeNull();
    expect(ageOn("081112-1234", "2026-11-12")).toBeNull();
  });
});
