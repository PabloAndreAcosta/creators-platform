import { describe, it, expect } from "vitest";
import { isValidNow, coversListing, grantsEntry } from "../access";

const NU = new Date("2026-10-15T19:00:00Z");
const KREATOR = "creator-1";
const SERIE_A = "serie-a";
const SERIE_B = "serie-b";

const plan = (o: Partial<Parameters<typeof coversListing>[0]> = {}) => ({
  creator_id: KREATOR,
  is_active: true,
  series_ids: null,
  ...o,
});

const kvall = (o: Partial<Parameters<typeof coversListing>[1]> = {}) => ({
  user_id: KREATOR,
  series_id: SERIE_A,
  hasRevenueShare: false,
  ...o,
});

describe("isValidNow", () => {
  it("gäller när perioden inte löpt ut", () => {
    expect(isValidNow({ status: "active", current_period_end: "2026-11-01T00:00:00Z" }, NU)).toBe(true);
  });

  it("en UPPSAGD prenumeration gäller perioden ut", () => {
    // Medlemmen har betalat för perioden. Att neka i dörren vore att ta
    // tillbaka något som redan är betalt.
    expect(isValidNow({ status: "canceled", current_period_end: "2026-11-01T00:00:00Z" }, NU)).toBe(true);
  });

  it("en AKTIV som inte förnyats gäller inte", () => {
    // Datumet avgör, inte statusfältet.
    expect(isValidNow({ status: "active", current_period_end: "2026-10-01T00:00:00Z" }, NU)).toBe(false);
  });

  it("obetald släpps inte in trots giltigt datum", () => {
    expect(isValidNow({ status: "past_due", current_period_end: "2026-11-01T00:00:00Z" }, NU)).toBe(false);
  });

  it("utan periodslut gäller ingenting", () => {
    expect(isValidNow({ status: "active", current_period_end: null }, NU)).toBe(false);
  });
});

describe("coversListing", () => {
  it("täcker kreatörens egen kväll", () => {
    expect(coversListing(plan(), kvall())).toBe(true);
  });

  it("öppnar ALDRIG någon annans dörr", () => {
    expect(coversListing(plan(), kvall({ user_id: "annan-kreator" }))).toBe(false);
  });

  it("gäller ALDRIG en kväll som delas med en lokal", () => {
    // Lokalen skulle få en gäst som inte betalat för just den kvällen, och vad
    // de får för den gästen är en förhandling — inte något koden hittar på.
    expect(coversListing(plan(), kvall({ hasRevenueShare: true }))).toBe(false);
  });

  it("tom serielista betyder kreatörens alla egna kvällar", () => {
    expect(coversListing(plan({ series_ids: [] }), kvall())).toBe(true);
    expect(coversListing(plan({ series_ids: null }), kvall({ series_id: null }))).toBe(true);
  });

  it("begränsad till vissa serier gäller bara dem", () => {
    expect(coversListing(plan({ series_ids: [SERIE_A] }), kvall({ series_id: SERIE_A }))).toBe(true);
    expect(coversListing(plan({ series_ids: [SERIE_A] }), kvall({ series_id: SERIE_B }))).toBe(false);
    expect(coversListing(plan({ series_ids: [SERIE_A] }), kvall({ series_id: null }))).toBe(false);
  });

  it("ett avstängt medlemskap öppnar ingenting", () => {
    expect(coversListing(plan({ is_active: false }), kvall())).toBe(false);
  });
});

describe("grantsEntry", () => {
  const giltigt = { status: "active", current_period_end: "2026-11-01T00:00:00Z" };

  it("kräver både giltighet och täckning", () => {
    expect(grantsEntry(giltigt, plan(), kvall(), NU)).toBe(true);
    expect(grantsEntry(giltigt, plan(), kvall({ hasRevenueShare: true }), NU)).toBe(false);
    expect(
      grantsEntry({ status: "active", current_period_end: "2026-01-01T00:00:00Z" }, plan(), kvall(), NU)
    ).toBe(false);
  });
});
