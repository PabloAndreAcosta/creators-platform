import { describe, it, expect } from "vitest";
import { filterSitemapListings } from "../sitemap-listings";

describe("filterSitemapListings", () => {
  const publik = new Set(["synlig"]);

  it("tar med en tjänst vars säljare har publik profil", () => {
    expect(filterSitemapListings([{ id: "a", event_date: null, user_id: "synlig" }], publik)).toHaveLength(1);
  });

  it("tar bort en tjänst vars säljare är dold (sidan ger 404)", () => {
    expect(filterSitemapListings([{ id: "b", event_date: null, user_id: "dold" }], publik)).toHaveLength(0);
  });

  it("behåller ett daterat evenemang även om värden är dold", () => {
    expect(
      filterSitemapListings([{ id: "c", event_date: "2026-12-01", user_id: "dold" }], publik)
    ).toHaveLength(1);
  });
});
