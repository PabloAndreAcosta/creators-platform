import { describe, it, expect } from "vitest";
import { decidePublicCache, anonymousCacheUrl, stripAnonParam } from "../public-pages";

const base = {
  method: "GET",
  pathname: "/upplevelser",
  searchParams: new URLSearchParams(),
  cookieNames: ["usha-locale", "usha_consent"],
  locale: "sv",
};

describe("decidePublicCache", () => {
  it("cachar en utloggad besökare på en publik sida", () => {
    expect(decidePublicCache(base)).toEqual({ cacheable: true, locale: "sv" });
  });

  it("cachar aldrig när en auth-cookie finns, oavsett domänvariant", () => {
    for (const name of ["sb-hiurrvorwqfihtdfhbhv-auth-token", "sb-hiurrvorwqfihtdfhbhv-auth-token.0", "sb-auth-auth-token"]) {
      expect(decidePublicCache({ ...base, cookieNames: [...base.cookieNames, name] })).toMatchObject({ cacheable: false, reason: "auth" });
    }
  });

  it("cachar inte när besökaren valt tema — standardtemat är det som cachas", () => {
    expect(decidePublicCache({ ...base, cookieNames: ["usha-theme"] })).toMatchObject({ cacheable: false, reason: "theme" });
  });

  it("cachar inte sidor med användarinnehåll eller annat än GET", () => {
    expect(decidePublicCache({ ...base, pathname: "/event/the-lab" })).toMatchObject({ cacheable: false, reason: "path" });
    expect(decidePublicCache({ ...base, pathname: "/app" })).toMatchObject({ cacheable: false, reason: "path" });
    expect(decidePublicCache({ ...base, method: "POST" })).toMatchObject({ cacheable: false, reason: "method" });
  });

  it("cachar inte anrop vars parametrar sätter cookies", () => {
    expect(decidePublicCache({ ...base, searchParams: new URLSearchParams("ref=PABLO") })).toMatchObject({ cacheable: false, reason: "param:ref" });
    expect(decidePublicCache({ ...base, searchParams: new URLSearchParams("utm_source=ig") })).toMatchObject({ cacheable: false, reason: "param:utm_source" });
    expect(decidePublicCache({ ...base, searchParams: new URLSearchParams("lang=en") })).toMatchObject({ cacheable: false, reason: "param:lang" });
  });

  it("låter sidans egna filter vara kvar", () => {
    expect(decidePublicCache({ ...base, searchParams: new URLSearchParams("location=Stockholm&sort=date") })).toMatchObject({ cacheable: true });
  });
});

describe("anonymousCacheUrl", () => {
  it("lägger språket i nyckeln och tar bort spårning", () => {
    const u = anonymousCacheUrl(new URL("https://usha.se/upplevelser?fbclid=abc&location=Stockholm"), "en");
    expect(u.pathname).toBe("/upplevelser");
    expect(u.searchParams.get("_anon")).toBe("en");
    expect(u.searchParams.has("fbclid")).toBe(false);
    expect(u.searchParams.get("location")).toBe("Stockholm");
  });

  it("ger samma nyckel oavsett parameterordning", () => {
    const a = anonymousCacheUrl(new URL("https://usha.se/upplevelser?a=1&b=2"), "sv").toString();
    const b = anonymousCacheUrl(new URL("https://usha.se/upplevelser?b=2&a=1"), "sv").toString();
    expect(a).toBe(b);
  });

  it("skriver över en inskickad _anon så att språket alltid är det lösta", () => {
    const u = anonymousCacheUrl(new URL("https://usha.se/?_anon=es"), "sv");
    expect(u.searchParams.getAll("_anon")).toEqual(["sv"]);
  });
});

describe("stripAnonParam", () => {
  it("tar bort _anon och lämnar resten", () => {
    expect(stripAnonParam(new URL("https://usha.se/kalender?_anon=sv&x=1"))?.toString()).toBe("https://usha.se/kalender?x=1");
  });
  it("returnerar null när inget finns att ta bort", () => {
    expect(stripAnonParam(new URL("https://usha.se/kalender"))).toBeNull();
  });
});
