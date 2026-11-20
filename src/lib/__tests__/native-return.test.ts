import { describe, expect, it } from "vitest";
import { isNativeAppRequest, safeAppReturnPath, viaAppReturn } from "../native-return";

describe("viaAppReturn", () => {
  it("lämnar webbens adress orörd", () => {
    expect(viaAppReturn("https://usha.se/app/tickets?success=true", false)).toBe(
      "https://usha.se/app/tickets?success=true",
    );
  });

  it("leder appens köp via /till-appen", () => {
    expect(viaAppReturn("https://usha.se/app/tickets?success=true", true)).toBe(
      "https://usha.se/till-appen?till=%2Fapp%2Ftickets%3Fsuccess%3Dtrue",
    );
  });

  it("behåller Stripes platshållare okodad så att den ersätts", () => {
    expect(viaAppReturn("https://usha.se/biljett/klar?session_id={CHECKOUT_SESSION_ID}", true)).toBe(
      "https://usha.se/till-appen?till=%2Fbiljett%2Fklar%3Fsession_id%3D{CHECKOUT_SESSION_ID}",
    );
  });
});

describe("isNativeAppRequest", () => {
  it("känner igen skalets user agent", () => {
    const req = new Request("https://usha.se", { headers: { "user-agent": "Mozilla/5.0 (Linux; Android 16) UshaPlatformApp" } });
    expect(isNativeAppRequest(req)).toBe(true);
    expect(isNativeAppRequest(new Request("https://usha.se"))).toBe(false);
  });
});

describe("safeAppReturnPath", () => {
  it("släpper bara igenom interna sökvägar", () => {
    expect(safeAppReturnPath("/app/tickets")).toBe("/app/tickets");
    expect(safeAppReturnPath("//evil.com")).toBe("/app");
    expect(safeAppReturnPath("https://evil.com")).toBe("/app");
    expect(safeAppReturnPath(null)).toBe("/app");
  });
});
