import { describe, it, expect } from "vitest";
import {
  isDatedEvent,
  blockingReason,
  matchTicketType,
  hasRoom,
} from "@/lib/bookings/move-occurrence";

const SERIE = "serie-1";
const from = { id: "a", event_date: "2026-10-08", series_id: SERIE, is_active: true, is_public: true };
const to = { id: "b", event_date: "2026-10-15", series_id: SERIE, is_active: true, is_public: true };
const typer = [
  { id: "t1", name: "Practica 17–19", capacity: null, tickets_sold: 0 },
  { id: "t2", name: "Allt: practica + workshop + social", capacity: 20, tickets_sold: 20 },
];
const bas = { from, to, today: "2026-10-06", ticketTypeName: "Practica 17–19", targetTypes: typer, quantity: 1 };

describe("isDatedEvent", () => {
  it("skiljer biljett från tjänstebokning", () => {
    expect(isDatedEvent({ event_date: "2026-10-08" })).toBe(true);
    expect(isDatedEvent({ event_date: null })).toBe(false);
    expect(isDatedEvent(null)).toBe(false);
  });
});

describe("matchTicketType", () => {
  it("matchar på namn trots nya id per kväll", () => {
    expect(matchTicketType("Practica 17–19", typer)?.id).toBe("t1");
  });
  it("struntar i skiftläge och blanksteg", () => {
    expect(matchTicketType("  practica 17–19 ", typer)?.id).toBe("t1");
  });
  it("ger null när typen inte finns på målkvällen", () => {
    expect(matchTicketType("Nybörjarkurs", typer)).toBeNull();
  });
});

describe("hasRoom", () => {
  it("utan tak finns alltid plats", () => {
    expect(hasRoom({ id: "x", name: "n", capacity: null, tickets_sold: 999 }, 5)).toBe(true);
  });
  it("räknar in den som flyttas", () => {
    expect(hasRoom({ id: "x", name: "n", capacity: 10, tickets_sold: 9 }, 1)).toBe(true);
    expect(hasRoom({ id: "x", name: "n", capacity: 10, tickets_sold: 10 }, 1)).toBe(false);
  });
});

describe("blockingReason", () => {
  it("släpper igenom en giltig flytt", () => {
    expect(blockingReason(bas)).toBeNull();
  });

  it("nekar flytt till samma kväll", () => {
    expect(blockingReason({ ...bas, to: from })).toBe("same_occurrence");
  });

  it("nekar flytt till en annan serie", () => {
    // Annars är det inte en ombokning utan ett byte av vara: annat pris,
    // annan lokal, kanske en annan arrangör.
    expect(blockingReason({ ...bas, to: { ...to, series_id: "serie-2" } })).toBe("not_same_series");
  });

  it("nekar en avpublicerad eller inaktiv kväll", () => {
    expect(blockingReason({ ...bas, to: { ...to, is_public: false } })).toBe("not_bookable");
    expect(blockingReason({ ...bas, to: { ...to, is_active: false } })).toBe("not_bookable");
  });

  it("nekar en kväll som varit", () => {
    expect(blockingReason({ ...bas, today: "2026-10-20" })).toBe("in_the_past");
  });

  it("tillåter flytt till kvällen som är i dag", () => {
    expect(blockingReason({ ...bas, today: "2026-10-15" })).toBeNull();
  });

  it("nekar när biljettypen saknas på målkvällen", () => {
    expect(blockingReason({ ...bas, ticketTypeName: "Nybörjarkurs" })).toBe("no_matching_type");
  });

  it("nekar när målkvällens biljettyp är slutsåld", () => {
    expect(
      blockingReason({ ...bas, ticketTypeName: "Allt: practica + workshop + social" })
    ).toBe("sold_out");
  });

  it("en bokning utan biljettyp kräver ingen matchning", () => {
    expect(blockingReason({ ...bas, ticketTypeName: null })).toBeNull();
  });

  // Avräkningen räknar en kvälls intäkt ur bookings.listing_id, så pengarna
  // följer med en flytt av sig själva — men en UTBETALD kväll räknas aldrig om.
  describe("avräknade kvällar", () => {
    it("nekar flytt FRÅN en utbetald kväll", () => {
      // Lokalen har redan fått sin andel av biljetten. Räknas målkvällen om
      // får den andelen igen: dubbelbetalning, tyst, i riktiga pengar.
      expect(blockingReason({ ...bas, fromSettled: true })).toBe("source_settled");
    });

    it("nekar flytt TILL en utbetald kväll", () => {
      // Biljetten landar i en stängd bok och lokalen får aldrig sin andel.
      expect(blockingReason({ ...bas, toSettled: true })).toBe("target_settled");
    });

    it("källan vägs före målet när båda är utbetalda", () => {
      expect(blockingReason({ ...bas, fromSettled: true, toSettled: true })).toBe("source_settled");
    });

    it("oavräknade kvällar flyttas fritt", () => {
      expect(blockingReason({ ...bas, fromSettled: false, toSettled: false })).toBeNull();
    });

    it("avräkningen vägs före slutsålt — pengar före platser", () => {
      expect(
        blockingReason({
          ...bas,
          ticketTypeName: "Allt: practica + workshop + social",
          fromSettled: true,
        })
      ).toBe("source_settled");
    });
  });
});
