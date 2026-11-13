import { describe, expect, it } from "vitest";
import { appPathFromUrl } from "./native";

describe("appPathFromUrl", () => {
  it("översätter eget schema till intern sökväg", () => {
    expect(appPathFromUrl("usha://app/events/123")).toBe("/app/events/123");
    expect(appPathFromUrl("usha:///app/events/123")).toBe("/app/events/123");
    expect(appPathFromUrl("usha://biljett/abc?x=1#top")).toBe("/biljett/abc?x=1#top");
    expect(appPathFromUrl("usha://")).toBe("/");
  });

  it("tar emot länkar till usha.se", () => {
    expect(appPathFromUrl("https://usha.se/kalender")).toBe("/kalender");
    expect(appPathFromUrl("https://www.usha.se/app?tab=x")).toBe("/app?tab=x");
  });

  it("ignorerar andra domäner och skräp", () => {
    expect(appPathFromUrl("https://evil.example/app")).toBeNull();
    expect(appPathFromUrl("javascript:alert(1)")).toBeNull();
    expect(appPathFromUrl("inte en url")).toBeNull();
  });
});
