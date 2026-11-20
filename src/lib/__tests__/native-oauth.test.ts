import { describe, expect, it } from "vitest";
import { nativeRedirectFor } from "../native-oauth";
import { appPathFromUrl } from "../native";

describe("nativeRedirectFor", () => {
  it("byter webbens callback mot appens och behåller next", () => {
    expect(nativeRedirectFor("https://usha.se/callback?next=%2Fapp%2Fevents")).toBe(
      "usha://callback?next=%2Fapp%2Fevents",
    );
  });

  it("utan next blir det bara usha://callback", () => {
    expect(nativeRedirectFor("https://usha.se/callback")).toBe("usha://callback");
  });

  it("tål en trasig adress", () => {
    expect(nativeRedirectFor("inte en url")).toBe("usha://callback");
  });

  it("återhoppet blir /callback med koden kvar, så servern kan växla in den", () => {
    expect(appPathFromUrl("usha://callback?code=abc&next=%2Fapp")).toBe("/callback?code=abc&next=%2Fapp");
  });
});

describe("appPathFromUrl och återhoppet från kortkassan", () => {
  it("går direkt till målet när /till-appen öppnar appen som applänk", () => {
    expect(appPathFromUrl("https://usha.se/till-appen?till=%2Fapp%2Ftickets%3Fsuccess%3Dtrue")).toBe(
      "/app/tickets?success=true",
    );
  });
  it("samma via usha://", () => {
    expect(appPathFromUrl("usha:///till-appen?till=%2Fbiljett%2Fklar")).toBe("/biljett/klar");
  });
  it("släpper inte igenom externa mål", () => {
    expect(appPathFromUrl("https://usha.se/till-appen?till=%2F%2Fevil.com")).toBe("/app");
  });
});
