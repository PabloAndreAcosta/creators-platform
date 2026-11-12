import { describe, it, expect } from "vitest";
import { isKioskPath } from "./kiosk-path";

describe("isKioskPath", () => {
  it("känner igen kioskens sidor, med och utan query", () => {
    expect(isKioskPath("/sjalvinslapp")).toBe(true);
    expect(isKioskPath("/sjalvinslapp/abc?tt=1")).toBe(true);
    expect(isKioskPath("/app/dorr")).toBe(true);
  });
  it("släpper inte igenom andra sidor", () => {
    expect(isKioskPath("/")).toBe(false);
    expect(isKioskPath("/dorr/the-lab-torsdag")).toBe(false);
    expect(isKioskPath("/app/dorrar")).toBe(false);
    expect(isKioskPath("/sjalvinslappen")).toBe(false);
    expect(isKioskPath("")).toBe(false);
  });
});
