import { describe, it, expect } from "vitest";
import {
  visibleAttendees,
  shouldShowAttendees,
  firstNameOf,
  type AttendeeCandidate,
} from "../visibility";

const profil = (id: string, fullName: string | null, isPublic = true) => ({
  id,
  fullName,
  avatarUrl: `https://x/${id}.jpg`,
  isPublic,
});

describe("visibleAttendees", () => {
  it("visar den som kryssat och har publik profil", () => {
    const c: AttendeeCandidate[] = [{ showAttendance: true, profile: profil("u1", "Anna Jois") }];
    expect(visibleAttendees(c)).toEqual([
      { id: "u1", firstName: "Anna", avatarUrl: "https://x/u1.jpg" },
    ]);
  });

  it("visar INTE den som låtit bli att kryssa", () => {
    // Köp är inget samtycke. Hela poängen med opt-in.
    const c: AttendeeCandidate[] = [
      { showAttendance: false, profile: profil("u1", "Anna Jois") },
      { showAttendance: null, profile: profil("u2", "Bea Berg") },
    ];
    expect(visibleAttendees(c)).toEqual([]);
  });

  it("visar INTE en dold profil, ens med kryss", () => {
    // Annars vore inställningen på profilen en lögn.
    const c: AttendeeCandidate[] = [
      { showAttendance: true, profile: profil("u1", "Anna Jois", false) },
    ];
    expect(visibleAttendees(c)).toEqual([]);
  });

  it("visar aldrig gästköp utan konto", () => {
    const c: AttendeeCandidate[] = [{ showAttendance: true, profile: null }];
    expect(visibleAttendees(c)).toEqual([]);
  });

  it("visar samma person en gång även vid flera köp", () => {
    const c: AttendeeCandidate[] = [
      { showAttendance: true, profile: profil("u1", "Anna Jois") },
      { showAttendance: true, profile: profil("u1", "Anna Jois") },
    ];
    expect(visibleAttendees(c)).toHaveLength(1);
  });

  it("hoppar över den utan användbart namn", () => {
    const c: AttendeeCandidate[] = [
      { showAttendance: true, profile: profil("u1", null) },
      { showAttendance: true, profile: profil("u2", "   ") },
    ];
    expect(visibleAttendees(c)).toEqual([]);
  });

  it("ger bara förnamnet", () => {
    const c: AttendeeCandidate[] = [
      { showAttendance: true, profile: profil("u1", "Mariana Prieto Abarca") },
    ];
    expect(visibleAttendees(c)[0].firstName).toBe("Mariana");
  });
});

describe("firstNameOf", () => {
  it("tar första ordet", () => {
    expect(firstNameOf("Pablo Andre Acosta")).toBe("Pablo");
    expect(firstNameOf("  Eva  Lind ")).toBe("Eva");
  });

  it("tom in ger tom ut", () => {
    expect(firstNameOf(null)).toBe("");
    expect(firstNameOf("   ")).toBe("");
  });
});

describe("shouldShowAttendees", () => {
  it("visar inget när funktionen är avstängd, hur många som än svarat", () => {
    expect(shouldShowAttendees(false, 100, 5)).toBe(false);
  });

  it("visar inget under tröskeln", () => {
    // "3 personer kommer" säljer sämre än ingenting alls.
    expect(shouldShowAttendees(true, 3, 5)).toBe(false);
  });

  it("visar vid och över tröskeln", () => {
    expect(shouldShowAttendees(true, 5, 5)).toBe(true);
    expect(shouldShowAttendees(true, 9, 5)).toBe(true);
  });
});
