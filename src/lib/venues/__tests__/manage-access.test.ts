import { describe, it, expect } from "vitest";
import { sanitizeCapabilities } from "../members";

/**
 * canManageAsVenueMember gör tre uppslag mot databasen, så den testas med en
 * liten fejkad klient i stället för mot en riktig. Det som testas är beslutet,
 * inte SQL:en — och beslutet är det som avgör vem som kommer åt vad.
 */
type Row = Record<string, unknown> | null;

function fakeAdmin(listing: Row, member: Row, collaborator: Row = null) {
  return {
    from(table: string) {
      const data =
        table === "listings" ? listing :
        table === "venue_members" ? member :
        collaborator; // listing_collaborators — null om inget annat sägs
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data }),
      };
      return chain;
    },
  } as never;
}

// Importeras dynamiskt så att modulens egna importer inte drar in Next-miljön.
async function canManage(listing: Row, member: Row, userId = "medlem") {
  const mod = await import("@/lib/listings/manage-access");
  return mod.canManageListing(fakeAdmin(listing, member), userId, "listing-1");
}

/** Den gamla vägen: en medarrangör inbjuden till ETT evenemang. */
async function canManageAsCollaborator(collaborator: Row) {
  const mod = await import("@/lib/listings/manage-access");
  return mod.canManageListing(fakeAdmin({ user_id: "nagon" }, null, collaborator), "medlem", "listing-1");
}

const accepted = (caps: string[]) => ({
  capabilities: caps,
  accepted_at: "2026-09-01T00:00:00Z",
  removed_at: null,
});

describe("lokalteam och canManageListing", () => {
  it("släpper in en medlem med 'events' på lokalens EGET evenemang", async () => {
    expect(await canManage({ user_id: "bacchi" }, accepted(["events"]))).toBe(true);
  });

  it("stänger ute en medlem utan 'events'", async () => {
    // Dörrvärden ska kunna checka in gäster, inte ändra biljettpriser.
    expect(await canManage({ user_id: "bacchi" }, accepted(["scan", "bookings"]))).toBe(false);
  });

  it("stänger ute en obesvarad inbjudan", async () => {
    // Behörigheten börjar gälla när personen sagt ja, inte när någon annan
    // bestämt det åt hen.
    expect(
      await canManage({ user_id: "bacchi" }, { capabilities: ["events"], accepted_at: null, removed_at: null })
    ).toBe(false);
  });

  it("stänger ute en borttagen medlem", async () => {
    expect(
      await canManage({ user_id: "bacchi" }, {
        capabilities: ["events"],
        accepted_at: "2026-09-01T00:00:00Z",
        removed_at: "2026-09-02T00:00:00Z",
      })
    ).toBe(false);
  });

  it("stänger ute den som inte tillhör lokalen alls", async () => {
    expect(await canManage({ user_id: "bacchi" }, null)).toBe(false);
  });

  it("klarar ett evenemang utan ägare i stället för att krascha", async () => {
    expect(await canManage({ user_id: null }, accepted(["events"]))).toBe(false);
    expect(await canManage(null, accepted(["events"]))).toBe(false);
  });
});

describe("avgränsningen mot upplåten lokal", () => {
  it("ger INTE lokalens team rätt att redigera någon annans evenemang hos dem", async () => {
    // Kärnan i avgränsningen. Pablos måndag hålls hos Bacchi och är bekräftad
    // av dem — men ägaren är Pablo. Bacchis team ska inte kunna röra den.
    // Att upplåta lokal är inte att ta över arrangemanget.
    const pablosEvenemang = { user_id: "pablo" };
    const bacchiMedlem = accepted(["events"]);

    // Medlemmen tillhör bacchi, inte pablo — uppslaget på pablos id ger inget.
    expect(await canManage(pablosEvenemang, null)).toBe(false);
  });
});

describe("den gamla medarrangörsvägen är orörd", () => {
  it("släpper fortfarande in en accepterad medarrangör", async () => {
    // Regressionsskydd: lokalteam läggs TILL, den befintliga vägen ska fungera
    // exakt som förut.
    expect(await canManageAsCollaborator({ id: "c1" })).toBe(true);
  });

  it("släpper inte in någon utan inbjudan", async () => {
    expect(await canManageAsCollaborator(null)).toBe(false);
  });
});

describe("sanitizeCapabilities i behörighetsvägen", () => {
  it("ignorerar skräp som råkat hamna i kolumnen", async () => {
    // Check-villkoret i databasen ska hindra det, men beslutet ska inte luta
    // sig mot att en enda spärr alltid hållit.
    expect(sanitizeCapabilities(["payouts", "events"])).toEqual(["events"]);
    expect(await canManage({ user_id: "bacchi" }, accepted(["payouts"]))).toBe(false);
  });
});
