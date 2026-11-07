import { describe, it, expect } from "vitest";

// Hemligheten läses när modulen laddas, så den sätts före importen.
process.env.BANKID_COOKIE_SECRET ||= "test-secret";
const { identityKey, parseIdMethod } = await import("../identity");
const { hashPersonalNumber } = await import("@/lib/signicat/crypto");

describe("identityKey", () => {
  it("svenskt personnummer ger samma nyckel med BankID och Freja", () => {
    const s = { nin: { value: "199001011234", issuingCountry: "SE" } };
    expect(identityKey(s, "sbid")).toBe(hashPersonalNumber("199001011234"));
    expect(identityKey(s, "freja")).toBe(identityKey(s, "sbid"));
  });
  it("utländskt nummer får landskoden och krockar inte med svenskt", () => {
    const gr = identityKey({ nin: { value: "199001011234", issuingCountry: "GR" } }, "freja");
    expect(gr).toBe(hashPersonalNumber("GR:199001011234"));
    expect(gr).not.toBe(hashPersonalNumber("199001011234"));
  });
  it("utan ID-nummer används e-legitimationens fasta användar-id", () => {
    expect(identityKey({ id: "abc-123" }, "freja")).toBe(hashPersonalNumber("freja:abc-123"));
  });
  it("saknas både nummer och id blir det ingen nyckel", () => {
    expect(identityKey({}, "freja")).toBeNull();
    expect(identityKey({ nin: { value: "  " } }, "freja")).toBeNull();
  });
  it("okänd metod blir BankID", () => {
    expect(parseIdMethod("freja")).toBe("freja");
    expect(parseIdMethod("xyz")).toBe("sbid");
    expect(parseIdMethod(undefined)).toBe("sbid");
  });
});
