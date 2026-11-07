import { describe, it, expect } from "vitest";
import { canSign, contentHash, isParty, signatureName, type PartyProfile } from "../model";
import { fillTemplate } from "../templates";

const base: PartyProfile = { id: "u1", full_name: "Anna Andersson", bankid_name: null, bankid_verified: false, email: "a@x.se", locale: "sv", avatar_url: null };

describe("avtal: fingeravtryck", () => {
  it("är stabilt för samma text och känsligt för ändringar", () => {
    const h = contentHash("Titel", "Text");
    expect(h).toHaveLength(64);
    expect(contentHash(" Titel ", "Text\n")).toBe(h); // blanksteg i kanterna räknas inte
    expect(contentHash("Titel", "Text.")).not.toBe(h);
    expect(contentHash("Titel!", "Text")).not.toBe(h);
  });
});

describe("avtal: vem får signera", () => {
  it("kräver BankID-verifierat konto med namn", () => {
    expect(canSign(base)).toBe(false);
    expect(canSign({ ...base, bankid_verified: true })).toBe(true);
    expect(canSign({ ...base, bankid_verified: true, full_name: null })).toBe(false);
    expect(canSign(null)).toBe(false);
  });
  it("skriver BankID-namnet under signaturen, annars profilnamnet", () => {
    expect(signatureName({ ...base, bankid_name: "ANNA ANDERSSON" })).toBe("ANNA ANDERSSON");
    expect(signatureName(base)).toBe("Anna Andersson");
  });
  it("bara parterna hör till avtalet", () => {
    const a = { created_by: "u1", counterparty_id: "u2" };
    expect(isParty(a, "u1")).toBe(true);
    expect(isParty(a, "u2")).toBe(true);
    expect(isParty(a, "u3")).toBe(false);
  });
});

describe("avtal: mallar", () => {
  it("fyller i kända platshållare och lämnar okända orörda", () => {
    expect(fillTemplate("{partA} och {partB} om {event} [belopp]", { partA: "A", partB: "B" })).toBe("A och B om {event} [belopp]");
  });
});
