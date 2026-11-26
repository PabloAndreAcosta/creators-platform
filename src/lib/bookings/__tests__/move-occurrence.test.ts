import { describe, it, expect } from "vitest";
import {
  isDatedEvent,
  blockingReason,
  matchTicketType,
  hasRoom,
  movedBookingFields,
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

    it("arrangören får flytta TILL en utbetald kväll inom kompletteringsfönstret", () => {
      // Gästen köpte fel kväll efter att kvällen betalats ut. Kompletteringen
      // räknar om kvällen och för över partnerns andel av den nya biljetten.
      const igar = { ...to, event_date: "2026-10-05" };
      expect(blockingReason({ ...bas, to: igar, toSettled: true, byArranger: true })).toBeNull();
    });

    it("nekar flytt TILL en utbetald kväll utanför fönstret", () => {
      const gammal = { ...to, event_date: "2026-08-01" };
      expect(blockingReason({ ...bas, to: gammal, toSettled: true, byArranger: true })).toBe("target_settled");
    });

    it("FRÅN en utbetald kväll nekas även för arrangören", () => {
      expect(blockingReason({ ...bas, fromSettled: true, byArranger: true })).toBe("source_settled");
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

describe("passerade kvällar", () => {
  const igar = { ...to, event_date: "2026-10-05" };
  it("gästen kan inte flytta till en kväll som varit", () => {
    expect(blockingReason({ ...bas, to: igar })).toBe("in_the_past");
  });
  it("arrangören kan, inom 30 dagar", () => {
    expect(blockingReason({ ...bas, to: igar, byArranger: true })).toBeNull();
  });
  it("men inte längre bak än fönstret", () => {
    const gammal = { ...to, event_date: "2026-08-01" };
    expect(blockingReason({ ...bas, to: gammal, byArranger: true })).toBe("in_the_past");
  });
});

describe("movedBookingFields", () => {
  it("flyttar scheduled_at till målkvällens tid (svensk vintertid)", () => {
    // Fallet 970cbd73: köpt till 26 nov, flyttad till 19 nov kl. 17.
    const f = movedBookingFields({ id: "kv19", event_date: "2026-11-19", event_time: "17:00:00" }, "tt19");
    expect(f.listing_id).toBe("kv19");
    expect(f.ticket_type_id).toBe("tt19");
    expect(f.scheduled_at).toBe("2026-11-19T16:00:00.000Z");
  });
  it("räknar sommartid rätt", () => {
    const f = movedBookingFields({ id: "x", event_date: "2026-07-09", event_time: "18:30" }, null);
    expect(f.scheduled_at).toBe("2026-07-09T16:30:00.000Z");
    expect("ticket_type_id" in f).toBe(false);
  });
  it("nollar påminnelserna så att gästen påminns om den nya kvällen", () => {
    const f = movedBookingFields({ id: "x", event_date: "2026-12-03", event_time: null }, null);
    expect(f.reminder_sent_at).toBeNull();
    expect(f.reminder_soon_sent_at).toBeNull();
    expect(f.scheduled_at).toBe("2026-12-02T23:00:00.000Z");
  });
});
