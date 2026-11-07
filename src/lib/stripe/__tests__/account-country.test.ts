import { describe, it, expect } from "vitest";
import { stripeAccountCountry } from "../account-country";

describe("stripeAccountCountry", () => {
  it("svenska kreatörer och overifierade får Sverige", () => {
    expect(stripeAccountCountry("5594018326", true)).toBe("SE");
    expect(stripeAccountCountry(null, false)).toBe("SE");
    expect(stripeAccountCountry("EL123456789", false)).toBe("SE");
  });
  it("verifierat utländskt bolag får bolagets land", () => {
    expect(stripeAccountCountry("EL123456789", true)).toBe("GR");
    expect(stripeAccountCountry("DE123456789", true)).toBe("DE");
    expect(stripeAccountCountry("XI123456789", true)).toBe("GB");
  });
});
