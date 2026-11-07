import { describe, it, expect } from "vitest";
import { checkVenueShareChange } from "../venue-share-lock";

describe("lokalens andel", () => {
  it("arrangören får inte sänka under lokalens standard", () => {
    expect(checkVenueShareChange(50, { kind: "save", partnerPercent: 0 }, false)).toEqual({ ok: false, reason: "lower" });
    expect(checkVenueShareChange(50, { kind: "save", partnerPercent: 49 }, false)).toEqual({ ok: false, reason: "lower" });
  });
  it("arrangören får inte ta bort andelen", () => {
    expect(checkVenueShareChange(50, { kind: "remove" }, false)).toEqual({ ok: false, reason: "remove" });
  });
  it("samma eller högre andel går bra", () => {
    expect(checkVenueShareChange(50, { kind: "save", partnerPercent: 50 }, false)).toEqual({ ok: true });
    expect(checkVenueShareChange(50, { kind: "save", partnerPercent: 60 }, false)).toEqual({ ok: true });
  });
  it("admin kan ändra efter överenskommelse med lokalen", () => {
    expect(checkVenueShareChange(50, { kind: "save", partnerPercent: 0 }, true)).toEqual({ ok: true });
    expect(checkVenueShareChange(50, { kind: "remove" }, true)).toEqual({ ok: true });
  });
  it("lokal utan standardandel: arrangören bestämmer som förut", () => {
    expect(checkVenueShareChange(null, { kind: "save", partnerPercent: 0 }, false)).toEqual({ ok: true });
    expect(checkVenueShareChange(null, { kind: "remove" }, false)).toEqual({ ok: true });
  });
});
