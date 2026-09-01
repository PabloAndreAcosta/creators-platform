import { describe, it, expect } from "vitest";
import {
  VENUE_CAPABILITIES,
  VENUE_PRESETS,
  isVenueCapability,
  sanitizeCapabilities,
  expandPreset,
  hasVenueCapability,
  NO_VENUE_ACCESS,
  type VenueAccess,
} from "../members";

describe("VENUE_CAPABILITIES", () => {
  it("innehåller INGEN behörighet för pengar", () => {
    // Kärnan i hela designen: den som ska hantera ekonomin är ägaren, så
    // pengar är inget man delegerar. Ett test här är billigare än att upptäcka
    // i efterhand att någon lagt till "payouts" för att det var bekvämt.
    const förbjudet = ["payouts", "stripe", "checkout", "gage", "billing", "delete", "grant", "owner"];
    for (const f of förbjudet) {
      expect(VENUE_CAPABILITIES as readonly string[]).not.toContain(f);
    }
  });

  it("har inga dubbletter", () => {
    expect(new Set(VENUE_CAPABILITIES).size).toBe(VENUE_CAPABILITIES.length);
  });
});

describe("isVenueCapability", () => {
  it("känner igen de riktiga", () => {
    expect(isVenueCapability("events")).toBe(true);
    expect(isVenueCapability("scan")).toBe(true);
  });

  it("avvisar påhittade och skräp", () => {
    expect(isVenueCapability("payouts")).toBe(false);
    expect(isVenueCapability("")).toBe(false);
    expect(isVenueCapability(null)).toBe(false);
    expect(isVenueCapability(42)).toBe(false);
  });
});

describe("sanitizeCapabilities", () => {
  it("släpper igenom giltiga", () => {
    expect(sanitizeCapabilities(["events", "scan"])).toEqual(["events", "scan"]);
  });

  it("kastar okända i stället för att avvisa allt", () => {
    // En klient som skickar med skräp ska inte kunna nolla hela sparningen —
    // men skräpet ska inte heller hamna i databasen.
    expect(sanitizeCapabilities(["events", "payouts", "scan"])).toEqual(["events", "scan"]);
  });

  it("tar bort dubbletter så raden inte kan svälla", () => {
    expect(sanitizeCapabilities(["scan", "scan", "scan"])).toEqual(["scan"]);
  });

  it("klarar allt som inte är en lista", () => {
    expect(sanitizeCapabilities(null)).toEqual([]);
    expect(sanitizeCapabilities("events")).toEqual([]);
    expect(sanitizeCapabilities({ events: true })).toEqual([]);
  });
});

describe("VENUE_PRESETS", () => {
  it("innehåller bara riktiga behörigheter", () => {
    // Ett förval är bara ett knippe av samma sex. Skulle ett förval innehålla
    // något påhittat vore det en tyst väg förbi check-villkoret i databasen.
    for (const [namn, caps] of Object.entries(VENUE_PRESETS)) {
      for (const c of caps) {
        expect(isVenueCapability(c), `${namn} innehåller ${c}`).toBe(true);
      }
    }
  });

  it("ger dörrvärden bara dörren", () => {
    expect(expandPreset("door")).toEqual(["scan", "bookings"]);
    expect(expandPreset("door")).not.toContain("events");
  });

  it("ger en kopia, inte originalet", () => {
    // Annars kan en anropare råka mutera förvalet för alla andra.
    const a = expandPreset("door");
    a.push("events");
    expect(expandPreset("door")).toEqual(["scan", "bookings"]);
  });

  it("ger tom lista för okänt förval i stället för att krascha", () => {
    expect(expandPreset("finns-inte")).toEqual([]);
  });
});

describe("hasVenueCapability", () => {
  const medlem: VenueAccess = { owner: false, capabilities: ["scan"] };
  const ägare: VenueAccess = { owner: true, capabilities: [...VENUE_CAPABILITIES] };

  it("ägaren har allt", () => {
    for (const c of VENUE_CAPABILITIES) {
      expect(hasVenueCapability(ägare, c)).toBe(true);
    }
  });

  it("medlemmen har bara sitt", () => {
    expect(hasVenueCapability(medlem, "scan")).toBe(true);
    expect(hasVenueCapability(medlem, "events")).toBe(false);
  });

  it("den utan åtkomst har ingenting", () => {
    for (const c of VENUE_CAPABILITIES) {
      expect(hasVenueCapability(NO_VENUE_ACCESS, c)).toBe(false);
    }
  });

  it("ägarskap räcker även med tom lista", () => {
    // Ägarskapet är sanningen, inte listan. Skulle listan råka vara tom ska
    // ägaren ändå komma in.
    expect(hasVenueCapability({ owner: true, capabilities: [] }, "events")).toBe(true);
  });
});
