import { describe, it, expect } from "vitest";
import { swishSeatsLeft, type SeatPending } from "../seats";

const pend = (id: string, guest_count: number, created_at: string, ticket_type_id: string | null = null): SeatPending => ({
  id,
  guest_count,
  ticket_type_id,
  created_at,
});

describe("swishSeatsLeft — platser kvar för ett Swish-köp", () => {
  const listing = { capacity: 10, tickets_sold: 6 };

  it("släpper igenom när antalet är precis det som är kvar", () => {
    expect(swishSeatsLeft({ listing, pending: [], quantity: 4 })).toEqual({ ok: true, left: 4 });
  });

  it("nekar en biljett för mycket", () => {
    expect(swishSeatsLeft({ listing, pending: [], quantity: 5 })).toEqual({ ok: false, left: 4 });
  });

  it("nekar när kvällen är slutsåld", () => {
    expect(swishSeatsLeft({ listing: { capacity: 10, tickets_sold: 10 }, pending: [], quantity: 1 })).toEqual({ ok: false, left: 0 });
  });

  it("aldrig negativt kvar när tickets_sold redan är över kapaciteten", () => {
    expect(swishSeatsLeft({ listing: { capacity: 10, tickets_sold: 12 }, pending: [], quantity: 1 })).toEqual({ ok: false, left: 0 });
  });

  it("ingen kapacitetsgräns släpper igenom vad som helst", () => {
    expect(swishSeatsLeft({ listing: { capacity: null, tickets_sold: 500 }, pending: [pend("a", 9, "2026-11-25T10:00:00Z")], quantity: 10 })).toEqual({ ok: true, left: null });
  });

  it("räknar vilande Swish-köp som tagna platser", () => {
    const pending = [pend("a", 2, "2026-11-25T10:00:00Z"), pend("b", 1, "2026-11-25T10:01:00Z")];
    expect(swishSeatsLeft({ listing, pending, quantity: 1 })).toEqual({ ok: true, left: 1 });
    expect(swishSeatsLeft({ listing, pending, quantity: 2 })).toEqual({ ok: false, left: 1 });
  });

  it("flera biljetter i ett köp räknas per plats, även i vilande köp", () => {
    const pending = [pend("a", 3, "2026-11-25T10:00:00Z")];
    expect(swishSeatsLeft({ listing, pending, quantity: 1 })).toEqual({ ok: true, left: 1 });
    expect(swishSeatsLeft({ listing, pending, quantity: 3 })).toEqual({ ok: false, left: 1 });
  });

  it("biljettypens egen gräns gäller när den är trängre än kvällens", () => {
    const ticketType = { id: "tt", capacity: 3, tickets_sold: 1 };
    const pending = [pend("a", 1, "2026-11-25T10:00:00Z", "tt"), pend("b", 1, "2026-11-25T10:00:00Z", "annan")];
    // Kvällen: 10 − 6 − 2 = 2. Typen: 3 − 1 − 1 = 1.
    expect(swishSeatsLeft({ listing, ticketType, pending, quantity: 1 })).toEqual({ ok: true, left: 1 });
    expect(swishSeatsLeft({ listing, ticketType, pending, quantity: 2 })).toEqual({ ok: false, left: 1 });
  });

  it("biljettyp utan gräns: kvällens gräns gäller", () => {
    const ticketType = { id: "tt", capacity: null, tickets_sold: 0 };
    expect(swishSeatsLeft({ listing, ticketType, pending: [], quantity: 5 })).toEqual({ ok: false, left: 4 });
  });

  describe("kapplöpningen: omräkning efter insert", () => {
    const tight = { capacity: 10, tickets_sold: 9 };

    it("den som kom först behåller den sista platsen, den andra nekas", () => {
      const pending = [pend("x", 1, "2026-11-25T10:00:00.100Z"), pend("y", 1, "2026-11-25T10:00:00.200Z")];
      expect(swishSeatsLeft({ listing: tight, pending, quantity: 1, ownBookingId: "x" }).ok).toBe(true);
      expect(swishSeatsLeft({ listing: tight, pending, quantity: 1, ownBookingId: "y" })).toEqual({ ok: false, left: 0 });
    });

    it("samma tidsstämpel: id avgör, så exakt en vinner", () => {
      const pending = [pend("b", 1, "2026-11-25T10:00:00Z"), pend("a", 1, "2026-11-25T10:00:00Z")];
      expect(swishSeatsLeft({ listing: tight, pending, quantity: 1, ownBookingId: "a" }).ok).toBe(true);
      expect(swishSeatsLeft({ listing: tight, pending, quantity: 1, ownBookingId: "b" }).ok).toBe(false);
    });

    it("den egna bokningen räknas inte mot sig själv", () => {
      const pending = [pend("x", 1, "2026-11-25T10:00:00Z")];
      expect(swishSeatsLeft({ listing: tight, pending, quantity: 1, ownBookingId: "x" })).toEqual({ ok: true, left: 1 });
    });
  });
});
