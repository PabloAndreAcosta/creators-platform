import { describe, it, expect } from "vitest";

/**
 * Regeln för vilka lokaler som blir valbara testas som en ren funktion, så den
 * går att låsa fast utan databas. Den avgör vad andra användare får se, och det
 * är inte något som ska kunna glida utan att någon märker det.
 */
function synligSomLokal(p: { is_public: boolean | null; company_verified_at: string | null }) {
  return p.is_public === true || p.company_verified_at != null;
}

const v = (is_public: boolean | null, company_verified_at: string | null = null) => ({
  is_public,
  company_verified_at,
});

describe("vilka lokaler som blir valbara", () => {
  it("visar en lokal som verifierat sitt bolag", () => {
    // Bacchi: profilen är inte publik, men bolaget är verifierat mot VIES.
    // Det är ett aktivt val som säger "vi är ett riktigt företag".
    expect(synligSomLokal(v(false, "2026-09-01T13:40:51Z"))).toBe(true);
  });

  it("visar en lokal som publicerat sin profil", () => {
    expect(synligSomLokal(v(true))).toBe(true);
  });

  it("visar INTE ett konto som bara råkat få rollen", () => {
    // Ett halvfärdigt konto ska inte hamna i en rullgardin hos alla andra.
    expect(synligSomLokal(v(false))).toBe(false);
    expect(synligSomLokal(v(null))).toBe(false);
  });

  it("räcker med ettdera", () => {
    expect(synligSomLokal(v(true, "2026-01-01T00:00:00Z"))).toBe(true);
  });
});
