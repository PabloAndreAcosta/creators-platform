import { describe, it, expect } from "vitest";
import { mottagareAvFoljare, type FollowerRow } from "../follower-audience";

const rad = (o: Partial<FollowerRow> = {}): FollowerRow => ({
  email: "anna@example.se",
  locale: "sv",
  confirmed_at: "2026-09-01T00:00:00Z",
  unsubscribed_at: null,
  unsubscribe_token: "tok-1",
  ...o,
});

describe("mottagareAvFoljare", () => {
  it("tar med den som bekräftat och inte avslutat", () => {
    expect(mottagareAvFoljare([rad()])).toEqual([
      { email: "anna@example.se", locale: "sv", unsubscribeToken: "tok-1" },
    ]);
  });

  it("utesluter den som aldrig bekräftade", () => {
    // Dubbel opt-in: en oskriven adress är inget ja.
    expect(mottagareAvFoljare([rad({ confirmed_at: null })])).toEqual([]);
  });

  it("utesluter den som sagt ifrån", () => {
    expect(mottagareAvFoljare([rad({ unsubscribed_at: "2026-09-20T00:00:00Z" })])).toEqual([]);
  });

  it("skickar aldrig utan en väg ut", () => {
    // Ett utskick utan avregistreringslänk får inte gå iväg över huvud taget.
    expect(mottagareAvFoljare([rad({ unsubscribe_token: null })])).toEqual([]);
  });

  it("skickar ett mejl per adress även vid flera följ", () => {
    // Samma person kan ha följt via en kväll, en serie och en profil.
    const ut = mottagareAvFoljare([
      rad({ unsubscribe_token: "a" }),
      rad({ unsubscribe_token: "b" }),
    ]);
    expect(ut).toHaveLength(1);
  });

  it("normaliserar adressen och hoppar över tomma", () => {
    const ut = mottagareAvFoljare([
      rad({ email: "  ANNA@Example.se " }),
      rad({ email: "" }),
      rad({ email: null }),
    ]);
    expect(ut).toEqual([{ email: "anna@example.se", locale: "sv", unsubscribeToken: "tok-1" }]);
  });
});
