import { describe, expect, it } from "vitest";
import { appSkalTaggar } from "./sentry-app";

describe("appSkalTaggar", () => {
  it("känner igen skalet via Capacitor-bryggan", () => {
    expect(appSkalTaggar({ Capacitor: { isNativePlatform: () => true, getPlatform: () => "android" } }))
      .toEqual({ skal: "app", plattform: "android" });
    expect(appSkalTaggar({ Capacitor: { isNativePlatform: () => true, getPlatform: () => "ios" } }))
      .toEqual({ skal: "app", plattform: "ios" });
  });

  it("faller tillbaka på user agent om bryggan inte hunnit laddas", () => {
    expect(appSkalTaggar({ navigator: { userAgent: "Mozilla/5.0 (Linux; Android 14) UshaPlatformApp" } }))
      .toEqual({ skal: "app", plattform: "okänd" });
  });

  it("är webb i en vanlig webbläsare och server utan fönster", () => {
    expect(appSkalTaggar({ navigator: { userAgent: "Mozilla/5.0 Safari" } })).toEqual({ skal: "webb" });
    expect(appSkalTaggar({ Capacitor: { isNativePlatform: () => false } })).toEqual({ skal: "webb" });
    expect(appSkalTaggar(undefined)).toEqual({ skal: "server" });
  });
});
