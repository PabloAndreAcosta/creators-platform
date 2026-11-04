import { describe, expect, it } from "vitest";
import { CONSENT_DEFAULTS, consentCookie, readConsent } from "../index";

describe("samtycke till statistik", () => {
  it("läser valet ur cookies, och inget val när det saknas eller är skräp", () => {
    expect(readConsent("")).toBeNull();
    expect(readConsent("usha_consent=granted")).toBe("granted");
    expect(readConsent("a=1; usha_consent=denied; b=2")).toBe("denied");
    expect(readConsent("usha_consent=maybe")).toBeNull();
    expect(readConsent("not_usha_consent=granted")).toBeNull();
  });

  it("sparar valet i sex månader, för hela sajten", () => {
    const c = consentCookie("granted");
    expect(c).toContain("usha_consent=granted");
    expect(c).toContain("Path=/");
    expect(c).toContain("Max-Age=15724800");
    expect(c).toContain("Secure");
    expect(consentCookie("denied", false)).not.toContain("Secure");
  });

  it("startar med allt nekat, även reklam", () => {
    expect(Object.values(CONSENT_DEFAULTS).every((v) => v === "denied")).toBe(true);
  });
});
