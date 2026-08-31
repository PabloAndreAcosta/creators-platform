import { describe, it, expect } from "vitest";
import { consentIdentity, consentState, shouldAskConsent } from "../consent";

describe("consentIdentity", () => {
  it("använder kontot när det finns", () => {
    expect(consentIdentity({ customer_id: "u1", guest_email: null })).toEqual({
      profileId: "u1",
      email: null,
    });
  });

  it("låter kontot gå före mejladressen", () => {
    // En gäst som senare skaffar konto med samma adress skulle annars kunna få
    // två rader som säger olika saker, och då finns inget svar på frågan.
    expect(consentIdentity({ customer_id: "u1", guest_email: "a@b.se" })).toEqual({
      profileId: "u1",
      email: null,
    });
  });

  it("använder mejladressen för gäster", () => {
    expect(consentIdentity({ customer_id: null, guest_email: "A@B.se" })).toEqual({
      profileId: null,
      email: "a@b.se",
    });
  });

  it("normaliserar mejladressen", () => {
    // Utan detta blir "A@b.se" och "a@b.se" två olika personer, och den ena
    // kan inte återkalla den andras samtycke.
    expect(consentIdentity({ customer_id: null, guest_email: "  Anna@Exempel.SE " })).toEqual({
      profileId: null,
      email: "anna@exempel.se",
    });
  });

  it("ger null när det varken finns konto eller mejl", () => {
    expect(consentIdentity({ customer_id: null, guest_email: null })).toBeNull();
    expect(consentIdentity({ customer_id: null, guest_email: "   " })).toBeNull();
  });
});

describe("consentState", () => {
  it("läser ja, nej och obesvarat", () => {
    expect(consentState({ granted_at: "2026-09-08", withdrawn_at: null })).toBe("granted");
    expect(consentState({ granted_at: "2026-09-08", withdrawn_at: "2026-09-09" })).toBe("withdrawn");
    expect(consentState(null)).toBe("unanswered");
  });

  it("låter återkallelsen väga tyngst", () => {
    // Raden behålls efter ett nej, så båda tidsstämplarna finns kvar. Nej vinner.
    expect(consentState({ granted_at: "2026-09-08", withdrawn_at: "2026-09-09" })).toBe("withdrawn");
  });
});

describe("shouldAskConsent", () => {
  const identity = { profileId: "u1", email: null } as const;

  it("frågar när lokalen är bekräftad", () => {
    expect(
      shouldAskConsent({ venueProfileId: "v1", venueConfirmedAt: "2026-09-01", identity })
    ).toBe(true);
  });

  it("frågar INTE för en obekräftad koppling", () => {
    // En arrangör som taggat en lokal utan dess ja får inte samla samtycke i
    // lokalens namn.
    expect(shouldAskConsent({ venueProfileId: "v1", venueConfirmedAt: null, identity })).toBe(false);
  });

  it("frågar inte när evenemanget saknar lokal", () => {
    expect(shouldAskConsent({ venueProfileId: null, venueConfirmedAt: null, identity })).toBe(false);
  });

  it("frågar inte när det inte går att veta vem som svarar", () => {
    expect(
      shouldAskConsent({ venueProfileId: "v1", venueConfirmedAt: "2026-09-01", identity: null })
    ).toBe(false);
  });
});
