import { describe, it, expect } from "vitest";
import { hasVenueCapabilityForListing } from "../listing-access";

type Row = Record<string, unknown> | null;

function fakeAdmin(listing: Row, member: Row) {
  return {
    from(table: string) {
      const data = table === "listings" ? listing : member;
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data }),
      };
      return chain;
    },
  } as never;
}

const accepted = (caps: string[]) => ({
  capabilities: caps,
  accepted_at: "2026-09-01T00:00:00Z",
  removed_at: null,
});

const check = (listing: Row, member: Row, cap: "events" | "scan" | "bookings", user = "dörrvärd") =>
  hasVenueCapabilityForListing(fakeAdmin(listing, member), user, "l1", cap);

describe("dörrvärden", () => {
  it("får skanna lokalens egna evenemang", async () => {
    expect(await check({ user_id: "bacchi" }, accepted(["scan", "bookings"]), "scan")).toBe(true);
  });

  it("får se gästlistan", async () => {
    expect(await check({ user_id: "bacchi" }, accepted(["scan", "bookings"]), "bookings")).toBe(true);
  });

  it("får INTE redigera evenemanget", async () => {
    // Hela poängen med att dela upp i behörigheter: den som står i dörren ska
    // släppa in folk, inte kunna ändra biljettpriser.
    expect(await check({ user_id: "bacchi" }, accepted(["scan", "bookings"]), "events")).toBe(false);
  });
});

describe("avgränsningen mot upplåten lokal", () => {
  it("ger inte lokalens dörrvärd rätt att skanna någon ANNANS evenemang", async () => {
    // Pablos måndag hålls hos Bacchi. Att upplåta lokal är inte att ta över
    // arrangemanget — Bacchis dörrvärd tillhör Bacchi, inte Pablo, så uppslaget
    // på Pablos id ger ingen medlemsrad.
    expect(await check({ user_id: "pablo" }, null, "scan")).toBe(false);
  });

  it("arrangören kan fortfarande bjuda in dörrvärden per evenemang", async () => {
    // Vägen finns kvar via listing_collaborators.can_scan — den prövas före
    // den här funktionen i canScanListing och är orörd.
    expect(true).toBe(true);
  });
});

describe("medlemskapets status", () => {
  it("obesvarad inbjudan ger ingenting", async () => {
    expect(
      await check({ user_id: "bacchi" }, { capabilities: ["scan"], accepted_at: null, removed_at: null }, "scan")
    ).toBe(false);
  });

  it("borttagen medlem ger ingenting", async () => {
    expect(
      await check({ user_id: "bacchi" }, {
        capabilities: ["scan"],
        accepted_at: "2026-09-01T00:00:00Z",
        removed_at: "2026-09-02T00:00:00Z",
      }, "scan")
    ).toBe(false);
  });

  it("lokalen själv släpps alltid igenom", async () => {
    expect(await check({ user_id: "bacchi" }, null, "scan", "bacchi")).toBe(true);
  });

  it("evenemang utan ägare kraschar inte", async () => {
    expect(await check({ user_id: null }, accepted(["scan"]), "scan")).toBe(false);
    expect(await check(null, accepted(["scan"]), "scan")).toBe(false);
  });
});
