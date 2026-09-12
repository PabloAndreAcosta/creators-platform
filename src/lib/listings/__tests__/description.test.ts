import { describe, it, expect } from "vitest";
import { splitBilingualDescription } from "../description";

describe("splitBilingualDescription", () => {
  it("delar på en separatorrad och namnger språket", () => {
    const r = splitBilingualDescription("Svensk text\n\n— English —\n\nEnglish text");
    expect(r.primary).toBe("Svensk text");
    expect(r.secondary).toBe("English text");
    expect(r.secondaryLabel).toBe("English below");
  });

  it("klarar olika streck och versaler", () => {
    for (const sep of ["--- ENGLISH ---", "English", "—english—", "== English =="]) {
      const r = splitBilingualDescription(`A\n${sep}\nB`);
      expect(r.secondary).toBe("B");
    }
  });

  it("rör inte en text utan separator", () => {
    const text = "Bara svenska.\n\nMed flera stycken.";
    expect(splitBilingualDescription(text)).toEqual({
      primary: text,
      secondary: null,
      secondaryLabel: null,
    });
  });

  it("delar inte när ena sidan är tom — då är raden en rubrik", () => {
    const r = splitBilingualDescription("English\n\nOnly one language here");
    expect(r.secondary).toBeNull();
  });

  it("hanterar tom och saknad text", () => {
    expect(splitBilingualDescription(null).primary).toBe("");
    expect(splitBilingualDescription("").secondary).toBeNull();
  });

  it("delar på första separatorn när flera finns", () => {
    const r = splitBilingualDescription("SV\n— English —\nEN\n— Svenska —\nmer");
    expect(r.primary).toBe("SV");
    expect(r.secondaryLabel).toBe("English below");
  });
});
