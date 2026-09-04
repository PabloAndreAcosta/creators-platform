import { describe, it, expect } from "vitest";
import { authUrlWithNext, callbackUrlWithNext, safeNextPath } from "../next-path";

describe("safeNextPath", () => {
  it("släpper igenom interna vägar", () => {
    expect(safeNextPath("/creators/abc")).toBe("/creators/abc");
  });

  it("stoppar öppen omdirigering", () => {
    // "//evil.example" tolkas av webbläsaren som en extern adress.
    expect(safeNextPath("//evil.example")).toBeNull();
    expect(safeNextPath("https://evil.example")).toBeNull();
  });

  it("tål tomt och saknat värde", () => {
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath("")).toBeNull();
  });
});

describe("authUrlWithNext", () => {
  it("bär med vägen tillbaka", () => {
    // Den som skannar lokalens QR och trycker Följ ska tillbaka till lokalen.
    expect(authUrlWithNext("/signup", "/creators/abc")).toBe("/signup?next=%2Fcreators%2Fabc");
  });

  it("kodar tecken som annars klipper adressen", () => {
    expect(authUrlWithNext("/login", "/app/messages?to=abc")).toBe(
      "/login?next=%2Fapp%2Fmessages%3Fto%3Dabc"
    );
  });

  it("ger bara sidan när det inte finns någon väg tillbaka", () => {
    expect(authUrlWithNext("/login", null)).toBe("/login");
    expect(authUrlWithNext("/login", "//evil.example")).toBe("/login");
  });
});

describe("callbackUrlWithNext", () => {
  it("bär med vägen tillbaka genom Google-inloggningen", () => {
    expect(callbackUrlWithNext("https://usha.se", "/creators/abc")).toBe(
      "https://usha.se/callback?next=%2Fcreators%2Fabc"
    );
  });

  it("faller tillbaka på ren callback utan väg", () => {
    expect(callbackUrlWithNext("https://usha.se", null)).toBe("https://usha.se/callback");
    expect(callbackUrlWithNext("https://usha.se", "https://evil.example")).toBe(
      "https://usha.se/callback"
    );
  });
});
