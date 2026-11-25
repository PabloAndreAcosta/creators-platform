import { describe, it, expect } from "vitest";
import { venueResponseState, shouldNotifyOrganiser } from "../venue-response";

describe("lokalens svar", () => {
  it("skiljer nej från inte svarat", () => {
    expect(venueResponseState({ venue_profile_id: "v" })).toBe("pending");
    expect(venueResponseState({ venue_profile_id: "v", venue_declined_at: "2026-11-25" })).toBe("declined");
    expect(venueResponseState({ venue_profile_id: "v", venue_confirmed_at: "2026-11-25" })).toBe("confirmed");
    expect(venueResponseState({ venue_profile_id: null })).toBe("none");
  });

  it("ett ja vinner över ett gammalt nej", () => {
    expect(venueResponseState({ venue_profile_id: "v", venue_confirmed_at: "x", venue_declined_at: "y" })).toBe("confirmed");
  });

  it("meddelar arrangören bara när svaret ändrades", () => {
    expect(shouldNotifyOrganiser("pending", true)).toBe(true);
    expect(shouldNotifyOrganiser("pending", false)).toBe(true);
    expect(shouldNotifyOrganiser("confirmed", false)).toBe(true);
    expect(shouldNotifyOrganiser("declined", true)).toBe(true);
    expect(shouldNotifyOrganiser("confirmed", true)).toBe(false);
    expect(shouldNotifyOrganiser("declined", false)).toBe(false);
  });
});
