import { describe, it, expect } from "vitest";
import {
  RETENTION_DAYS,
  anonymizedPatch,
  shouldAnonymize,
  skipReason,
  type GuestBookingRow,
} from "../guest-bookings";

const NOW = new Date("2026-10-12T12:00:00Z");

function row(over: Partial<GuestBookingRow> = {}): GuestBookingRow {
  return {
    id: "b1",
    guest_email: "gast@example.com",
    guest_name: "Gäst Gästsson",
    event_date: "2026-01-01",
    created_at: "2025-12-01T10:00:00Z",
    anonymized_at: null,
    ...over,
  };
}

describe("gallring av gästuppgifter", () => {
  it("gallrar en gammal kväll", () => {
    expect(shouldAnonymize(row(), NOW)).toBe(true);
  });

  it("rör aldrig en kväll innanför fönstret", () => {
    expect(skipReason(row({ event_date: "2026-09-01" }), NOW)).toBe("inside_window");
  });

  it("räknar från kvällen, inte från köpet", () => {
    // Köpt för länge sedan, men kvällen har inte varit än.
    const framtida = row({ created_at: "2025-01-01T10:00:00Z", event_date: "2026-12-24" });
    expect(skipReason(framtida, NOW)).toBe("inside_window");
  });

  it("faller tillbaka på köpdatum när eventdatum saknas", () => {
    const tjanst = row({ event_date: null, created_at: "2025-01-01T10:00:00Z" });
    expect(shouldAnonymize(tjanst, NOW)).toBe(true);
    const nyligen = row({ event_date: null, created_at: "2026-10-01T10:00:00Z" });
    expect(skipReason(nyligen, NOW)).toBe("inside_window");
  });

  it("är idempotent", () => {
    expect(skipReason(row({ anonymized_at: "2026-05-01T00:00:00Z" }), NOW)).toBe("already_anonymized");
  });

  it("hoppar över rader utan något att rensa", () => {
    expect(skipReason(row({ guest_email: null, guest_name: null }), NOW)).toBe("nothing_to_clear");
  });

  it("gallrar precis utanför gränsen men inte precis innanför", () => {
    const dag = 86_400_000;
    const utanfor = new Date(NOW.getTime() - (RETENTION_DAYS + 1) * dag).toISOString().slice(0, 10);
    const innanfor = new Date(NOW.getTime() - (RETENTION_DAYS - 2) * dag).toISOString().slice(0, 10);
    expect(shouldAnonymize(row({ event_date: utanfor }), NOW)).toBe(true);
    expect(skipReason(row({ event_date: innanfor }), NOW)).toBe("inside_window");
  });

  it("behåller gästmarkeringen men tappar personen", () => {
    const patch = anonymizedPatch(NOW);
    expect(patch.guest_name).toBeNull();
    expect(patch.guest_email).not.toContain("example.com");
    expect(patch.anonymized_at).toBe(NOW.toISOString());
  });
});
