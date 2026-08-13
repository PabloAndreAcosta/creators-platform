import { describe, it, expect } from "vitest";
import {
  getConnectionState,
  expiryFromExpiresIn,
  EXPIRY_WARNING_DAYS,
} from "../connection-state";

const NOW = new Date("2026-08-13T10:00:00Z");

function inDays(days: number): string {
  return new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

describe("getConnectionState", () => {
  it("saknat token är frånkopplat, inte utgånget", () => {
    const state = getConnectionState({ hasToken: false, expiresAt: null }, NOW);
    expect(state.status).toBe("disconnected");
    expect(state.needsAction).toBe(false);
  });

  it("token utan utgång räknas som anslutet (FB-sidtoken dör aldrig)", () => {
    const state = getConnectionState({ hasToken: true, expiresAt: null }, NOW);
    expect(state.status).toBe("connected");
    expect(state.daysLeft).toBeNull();
    expect(state.needsAction).toBe(false);
  });

  it("token långt fram i tiden är anslutet", () => {
    const state = getConnectionState({ hasToken: true, expiresAt: inDays(60) }, NOW);
    expect(state.status).toBe("connected");
    expect(state.daysLeft).toBe(60);
  });

  it("token inom varningsfönstret ber om omkoppling i förväg", () => {
    const state = getConnectionState({ hasToken: true, expiresAt: inDays(3) }, NOW);
    expect(state.status).toBe("expiring_soon");
    expect(state.daysLeft).toBe(3);
    expect(state.needsAction).toBe(true);
  });

  it("gränsen mellan anslutet och snart utgånget ligger vid varningsfönstret", () => {
    const justInside = getConnectionState(
      { hasToken: true, expiresAt: inDays(EXPIRY_WARNING_DAYS - 0.5) },
      NOW
    );
    const justOutside = getConnectionState(
      { hasToken: true, expiresAt: inDays(EXPIRY_WARNING_DAYS + 0.5) },
      NOW
    );
    expect(justInside.status).toBe("expiring_soon");
    expect(justOutside.status).toBe("connected");
  });

  it("passerad utgång är utgången och kräver åtgärd", () => {
    const state = getConnectionState({ hasToken: true, expiresAt: inDays(-1) }, NOW);
    expect(state.status).toBe("expired");
    expect(state.needsAction).toBe(true);
  });

  it("exakt nu räknas som utgånget, inte som giltigt", () => {
    const state = getConnectionState({ hasToken: true, expiresAt: NOW.toISOString() }, NOW);
    expect(state.status).toBe("expired");
  });

  it("Pablos verkliga IG-koppling: 60 dagar från 2 juni är död i augusti", () => {
    const state = getConnectionState(
      { hasToken: true, expiresAt: "2026-08-01T12:54:58Z" },
      NOW
    );
    expect(state.status).toBe("expired");
    expect(state.needsAction).toBe(true);
  });

  it("trasigt datum tolkas som utgånget hellre än giltigt för alltid", () => {
    const state = getConnectionState({ hasToken: true, expiresAt: "inte-ett-datum" }, NOW);
    expect(state.status).toBe("expired");
    expect(state.needsAction).toBe(true);
  });

  it("accepterar Date lika väl som ISO-sträng", () => {
    const state = getConnectionState(
      { hasToken: true, expiresAt: new Date(inDays(30)) },
      NOW
    );
    expect(state.status).toBe("connected");
    expect(state.daysLeft).toBe(30);
  });
});

describe("expiryFromExpiresIn", () => {
  it("räknar om sekunder till en absolut tidpunkt", () => {
    expect(expiryFromExpiresIn(5184000, NOW)).toBe("2026-10-12T10:00:00.000Z");
  });

  it("accepterar sekunder som sträng", () => {
    expect(expiryFromExpiresIn("86400", NOW)).toBe("2026-08-14T10:00:00.000Z");
  });

  it("saknat eller orimligt värde ger null i stället för ett falskt datum", () => {
    expect(expiryFromExpiresIn(undefined, NOW)).toBeNull();
    expect(expiryFromExpiresIn(null, NOW)).toBeNull();
    expect(expiryFromExpiresIn(0, NOW)).toBeNull();
    expect(expiryFromExpiresIn(-100, NOW)).toBeNull();
    expect(expiryFromExpiresIn("snart", NOW)).toBeNull();
  });
});
