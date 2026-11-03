import { describe, it, expect, beforeEach } from "vitest";
import crypto from "crypto";
import { gamesReturnUrl, safeGamesReturn, signGamesHandoff } from "../games-token";

describe("Åldersbevis till Usha Games", () => {
  beforeEach(() => {
    delete process.env.GAMES_ORIGIN;
  });

  it("signerar ett bevis som bara säger över 18 och går ut efter två minuter", () => {
    const token = signGamesHandoff("hemligt", 1000);
    const [payload, sig] = token.split(".");
    expect(JSON.parse(Buffer.from(payload, "base64url").toString())).toEqual({ p: "handoff", adult: true, exp: 1120 });
    expect(sig).toBe(crypto.createHmac("sha256", "hemligt").update(payload).digest("base64url"));
  });

  it("godtar bara appens egna sidor som återvändsadress", () => {
    expect(safeGamesReturn("/spel/?vuxen")).toBe("/spel/?vuxen");
    expect(safeGamesReturn("/spel/?kod=ABCDE")).toBe("/spel/?kod=ABCDE");
    for (const bad of ["https://ond.se/spel/", "//ond.se/spel/", "/app", "/spel//ond.se", "/spel/\\\\x", "/spel/#x", "/spel/<x>", null, 5]) {
      expect(safeGamesReturn(bad)).toBe("/spel/?vuxen");
    }
  });

  it("lägger beviset i fragmentet på spelens domän", () => {
    expect(gamesReturnUrl("/spel/?vuxen", { legitimering: "a.b" })).toBe("https://ushagames.se/spel/?vuxen#legitimering=a.b");
    expect(gamesReturnUrl("https://ond.se", { fel: "under18" })).toBe("https://ushagames.se/spel/?vuxen#legitimering-fel=under18");
  });
});
