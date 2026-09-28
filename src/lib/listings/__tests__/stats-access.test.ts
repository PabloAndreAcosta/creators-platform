import { describe, it, expect, vi } from "vitest";
import { listingStatsAccess, mayViewStats } from "../stats-access";

vi.mock("@/lib/venues/listing-access", () => ({
  hasVenueCapabilityForListing: vi.fn(async () => venueHasStats),
}));

let venueHasStats = false;

/** Minimal stubb som bara svarar på listing_collaborators-frågan. */
function admin(collab: unknown) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: collab }) }),
          }),
        }),
      }),
    }),
  } as never;
}

const OWNER = "owner-1";
const LISTING = "listing-1";

describe("listingStatsAccess", () => {
  it("ägaren ser allt", async () => {
    venueHasStats = false;
    expect(await listingStatsAccess(admin(null), OWNER, LISTING, OWNER)).toBe("full");
  });

  it("medarrangör ser allt, deltagarlistan inräknad", async () => {
    // can_manage innebär redan att man hanterar gästerna på andra sidor. Att
    // dölja listan just här hade bara varit teater.
    venueHasStats = false;
    const a = admin({ can_manage: true, can_view_stats: false });
    expect(await listingStatsAccess(a, "u2", LISTING, OWNER)).toBe("full");
  });

  it("läsbehörighet ger SIFFRORNA men inte deltagarlistan", async () => {
    // Hela poängen med behörigheten.
    venueHasStats = false;
    const a = admin({ can_manage: false, can_view_stats: true });
    expect(await listingStatsAccess(a, "u3", LISTING, OWNER)).toBe("numbers");
  });

  it("lokalteamets stats-behörighet ser allt", async () => {
    venueHasStats = true;
    const a = admin(null);
    expect(await listingStatsAccess(a, "u4", LISTING, OWNER)).toBe("full");
  });

  it("utan behörighet: ingenting", async () => {
    venueHasStats = false;
    expect(await listingStatsAccess(admin(null), "u5", LISTING, OWNER)).toBe("none");
    const a = admin({ can_manage: false, can_view_stats: false });
    expect(await listingStatsAccess(a, "u6", LISTING, OWNER)).toBe("none");
  });

  it("läsbehörighet ger ALDRIG mer än siffror, ens i kombination", async () => {
    // Skyddar mot att någon senare låter can_view_stats trilla igenom som
    // "full" för att den råkar ligga före can_manage i en omskriven if-sats.
    venueHasStats = false;
    const a = admin({ can_manage: false, can_view_stats: true });
    expect(await listingStatsAccess(a, "u7", LISTING, OWNER)).not.toBe("full");
  });
});

describe("mayViewStats", () => {
  it("släpper igenom både full och numbers", () => {
    expect(mayViewStats("full")).toBe(true);
    expect(mayViewStats("numbers")).toBe(true);
    expect(mayViewStats("none")).toBe(false);
  });
});
