import { describe, it, expect } from "vitest";
import { matchPages } from "../page-search";

const tr = (k: string) => ({ partnerLabel: "Partnerprogram", partnerDesc: "Bjud in andra med din länk." } as Record<string, string>)[k] ?? k;

describe("matchPages", () => {
  it("hittar partnerprogrammet på synonymer", () => {
    for (const q of ["bjud in", "Referral", "värva", "partner"]) {
      expect(matchPages(q, tr).map((p) => p.path)).toContain("/app/partner");
    }
  });
  it("hittar inget på skräp", () => {
    expect(matchPages("duJB", tr)).toEqual([]);
  });
});
