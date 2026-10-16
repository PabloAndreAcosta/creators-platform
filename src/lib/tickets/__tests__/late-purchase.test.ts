import { describe, it, expect } from "vitest";
import { efterkopLage, efterkopOppet, EFTERKOP_FONSTER_TIMMAR } from "../late-purchase";
import { sessionLivslangdMinuter } from "../late-checkout";

/**
 * Efterköpsfönstret.
 *
 * Alla tider nedan är UTC. The Lab torsdag 15 oktober 2026 slutar 23:59 svensk
 * tid, vilket under sommartid (CEST, UTC+2) är 21:59 UTC. Fönstret stänger ett
 * dygn senare.
 */

const KVALL = "2026-10-15";

describe("efterkopLage", () => {
  it("är inte aktuellt medan kvällen pågår", () => {
    // 22:00 svensk tid på kvällen — socialen är igång, vanlig kassa gäller.
    expect(efterkopLage(KVALL, new Date("2026-10-15T20:00:00Z")).kind).toBe("inte_aktuellt");
  });

  it("är inte aktuellt för en kväll som inte varit", () => {
    expect(efterkopLage("2026-10-22", new Date("2026-10-16T08:00:00Z")).kind).toBe("inte_aktuellt");
  });

  it("öppnar när kvällen tagit slut", () => {
    // 00:30 svensk tid natten efter.
    const lage = efterkopLage(KVALL, new Date("2026-10-15T22:30:00Z"));
    expect(lage.kind).toBe("oppet");
  });

  it("är öppet på morgonen efter — Maries fall", () => {
    // Marie försökte betala 07:24 svensk tid den 16 oktober.
    const lage = efterkopLage(KVALL, new Date("2026-10-16T05:24:00Z"));
    expect(lage.kind).toBe("oppet");
  });

  it("stänger ett dygn efter att kvällen tog slut", () => {
    // 21:59 UTC den 16:e = precis ett dygn efter slutet. Fortfarande öppet.
    expect(efterkopLage(KVALL, new Date("2026-10-16T21:59:00Z")).kind).toBe("oppet");
    // En minut senare är det stängt.
    expect(efterkopLage(KVALL, new Date("2026-10-16T22:01:00Z")).kind).toBe("stangt");
  });

  it("är stängt för en kväll förra veckan", () => {
    expect(efterkopLage("2026-10-08", new Date("2026-10-16T08:00:00Z")).kind).toBe("stangt");
  });

  it("ger aldrig efterköp för en post utan datum", () => {
    // Tjänster har ingen kväll att ha missat.
    expect(efterkopLage(null, new Date()).kind).toBe("inte_aktuellt");
    expect(efterkopLage(undefined, new Date()).kind).toBe("inte_aktuellt");
    expect(efterkopLage("", new Date()).kind).toBe("inte_aktuellt");
  });

  it("säger när fönstret stänger", () => {
    const lage = efterkopLage(KVALL, new Date("2026-10-16T05:00:00Z"));
    if (lage.kind !== "oppet") throw new Error("förväntade öppet");
    // Ett dygn efter kvällens slut.
    expect(lage.stangerVid.toISOString()).toBe("2026-10-16T21:59:00.000Z");
  });

  it("hanterar vintertid utan att tappa en timme", () => {
    // 5 november är efter omställningen: svensk tid är då UTC+1, så kvällen
    // slutar 22:59 UTC i stället för 21:59. Räknas gränsen i UTC rakt av blir
    // fönstret en timme fel halva året.
    const lage = efterkopLage("2026-11-05", new Date("2026-11-05T23:30:00Z"));
    expect(lage.kind).toBe("oppet");
    if (lage.kind !== "oppet") return;
    expect(lage.stangerVid.toISOString()).toBe("2026-11-06T22:59:00.000Z");
  });
});

describe("efterkopOppet", () => {
  it("är sann bara i det öppna läget", () => {
    expect(efterkopOppet(KVALL, new Date("2026-10-16T05:24:00Z"))).toBe(true);
    expect(efterkopOppet(KVALL, new Date("2026-10-15T20:00:00Z"))).toBe(false);
    expect(efterkopOppet(KVALL, new Date("2026-10-20T08:00:00Z"))).toBe(false);
  });
});

describe("fönstret", () => {
  it("är ett dygn", () => {
    expect(EFTERKOP_FONSTER_TIMMAR).toBe(24);
  });
});

/**
 * Sessionens livslängd.
 *
 * Första versionen av efterköpet bad Stripe om 15 minuter. Stripe accepterar
 * bara 30 minuter till 24 timmar, så koden hade fallerat i det ögonblick en
 * gäst faktiskt skulle betala — och felet var osynligt i både typkontroll och
 * bygge. Därför har gränsen egna test.
 */
describe("sessionLivslangdMinuter", () => {
  it("lyfter för korta värden till Stripes minimum", () => {
    expect(sessionLivslangdMinuter(15)).toBe(30);
    expect(sessionLivslangdMinuter(1)).toBe(30);
    expect(sessionLivslangdMinuter(0)).toBe(30);
    expect(sessionLivslangdMinuter(-5)).toBe(30);
  });

  it("låter rimliga värden passera", () => {
    expect(sessionLivslangdMinuter(30)).toBe(30);
    expect(sessionLivslangdMinuter(60)).toBe(60);
  });

  it("kapar vid ett dygn", () => {
    expect(sessionLivslangdMinuter(10_000)).toBe(1440);
  });

  it("faller tillbaka på minimum när inget anges", () => {
    expect(sessionLivslangdMinuter(undefined)).toBe(30);
    expect(sessionLivslangdMinuter(NaN)).toBe(30);
    expect(sessionLivslangdMinuter(Infinity)).toBe(30);
  });
});
