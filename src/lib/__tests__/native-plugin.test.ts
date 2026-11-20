import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { nativePlugin } from "../native";

// Node-miljö: ett minimalt window räcker, nativePlugin läser bara window.Capacitor.
const g = globalThis as unknown as { window?: { Capacitor?: unknown } };
let window: { Capacitor?: unknown };
beforeEach(() => {
  window = {};
  g.window = window;
});
afterEach(() => {
  delete g.window;
});

describe("nativePlugin", () => {
  it("hittar pluginen i Capacitor.Plugins när bryggan saknar registerPlugin (fjärrsida i skalet)", () => {
    const browser = { open: () => Promise.resolve() };
    window.Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => "android",
      Plugins: { Browser: browser },
    };
    expect(nativePlugin("Browser")).toBe(browser);
  });

  it("ger null i vanlig webbläsare", () => {
    expect(nativePlugin("Browser")).toBeNull();
  });

  it("ger null om pluginen inte finns", () => {
    window.Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => "android",
      Plugins: {},
    };
    expect(nativePlugin("Browser")).toBeNull();
  });
});
