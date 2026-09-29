import { describe, it, expect } from "vitest";
import { passExpiryFrom, passExpired, passBookingFields } from "../series-pass";

describe("passExpiryFrom", () => {
  it("ett tiokort räcker i tio månader", () => {
    const ut = passExpiryFrom(new Date("2026-09-30T12:00:00Z"), 10);
    expect(ut.toISOString().slice(0, 10)).toBe("2027-07-30");
  });

  it("ett femkort räcker i fem månader", () => {
    const ut = passExpiryFrom(new Date("2026-09-30T12:00:00Z"), 5);
    expect(ut.toISOString().slice(0, 10)).toBe("2027-02-28");
  });

  it("klampar till månadens sista dag i stället för att hoppa över", () => {
    // 31 januari + 1 månad blir 3 mars i rå JS. Ett kort får inte tjäna tre
    // extra dagar på att köpas en 31:e.
    const ut = passExpiryFrom(new Date("2026-01-31T12:00:00Z"), 1);
    expect(ut.toISOString().slice(0, 10)).toBe("2026-02-28");
  });

  it("tar hänsyn till skottår", () => {
    const ut = passExpiryFrom(new Date("2028-01-31T12:00:00Z"), 1);
    expect(ut.toISOString().slice(0, 10)).toBe("2028-02-29");
  });
});

describe("passExpired", () => {
  const nu = new Date("2026-09-30T12:00:00Z");

  it("ett kort utan datum gäller tills vidare", () => {
    // Kort sålda före ändringen köptes utan giltighetstid och får inte
    // förfalla i efterhand.
    expect(passExpired(null, nu)).toBe(false);
    expect(passExpired(undefined, nu)).toBe(false);
  });

  it("gäller fram till datumet", () => {
    expect(passExpired("2026-10-01T00:00:00Z", nu)).toBe(false);
  });

  it("har gått ut efter datumet", () => {
    expect(passExpired("2026-09-29T00:00:00Z", nu)).toBe(true);
  });
});

describe("passBookingFields", () => {
  it("sätter utgångsdatum vid köpet", () => {
    const f = passBookingFields(10, new Date("2026-09-30T12:00:00Z")) as {
      sessions_total: number;
      pass_expires_at: string;
    };
    expect(f.sessions_total).toBe(10);
    expect(f.pass_expires_at.slice(0, 10)).toBe("2027-07-30");
  });

  it("en vanlig biljett får inga klippfält", () => {
    expect(passBookingFields(null)).toEqual({});
    expect(passBookingFields(0)).toEqual({});
    expect(passBookingFields("inte ett tal")).toEqual({});
  });
});
