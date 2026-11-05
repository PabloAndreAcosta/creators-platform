import { describe, it, expect } from "vitest";
import { matchPages } from "../page-search";

const tr = (k: string) =>
  ({ partnerLabel: "Partnerprogram", partnerDesc: "Din länk, dina värvningar och vad de gett.", taxiLabel: "Volontärpass", taxiDesc: "Pass" } as Record<string, string>)[k] ?? k;

describe("matchPages", () => {
  it("bjud in leder till volontärpassen, inte partnerprogrammet", () => {
    const paths = matchPages("bjud in", tr).map((p) => p.path);
    expect(paths).toContain("/app/taxi");
    expect(paths).not.toContain("/app/partner");
  });
  it("hittar sidor på namnet", () => {
    expect(matchPages("partner", tr).map((p) => p.path)).toContain("/app/partner");
  });
  it("hittar inget på skräp", () => {
    expect(matchPages("duJB", tr)).toEqual([]);
  });
});
