import { describe, it, expect } from "vitest";
import {
  pickOccurrence,
  pickTicketType,
  doorTarget,
  isCancelled,
  type DoorOccurrence,
  type DoorTicketType,
} from "../door-link";

const kväll = (datum: string, titel = "The Lab Torsdag"): DoorOccurrence => ({
  slug: `the-lab-${datum}`,
  title: titel,
  event_date: datum,
});

const typ = (o: Partial<DoorTicketType> & { name: string; sort_order: number }): DoorTicketType => ({
  id: `tt-${o.sort_order}`,
  capacity: null,
  tickets_sold: 0,
  ...o,
});

const TYPER = [
  typ({ name: "Practica 17–19", sort_order: 0 }),
  typ({ name: "Workshop 19–20", sort_order: 1 }),
  typ({ name: "Social 20–23", sort_order: 2 }),
  typ({ name: "Allt: practica + workshop + social", sort_order: 3 }),
];

describe("pickOccurrence", () => {
  it("väljer kvällen som är i dag, inte nästa vecka", () => {
    // Dörrförsäljningen används MITT i kvällen. Hoppar den till nästa vecka
    // kl. 20 säljer vi fel biljett till den som står i dörren.
    const ut = pickOccurrence([kväll("2026-09-24"), kväll("2026-10-01"), kväll("2026-10-08")], "2026-10-01");
    expect(ut?.event_date).toBe("2026-10-01");
  });

  it("hoppar över kvällar som varit", () => {
    const ut = pickOccurrence([kväll("2026-09-21"), kväll("2026-10-08")], "2026-10-01");
    expect(ut?.event_date).toBe("2026-10-08");
  });

  it("hoppar över inställda kvällar", () => {
    // Att sälja en biljett till en inställd kväll är värre än att inte sälja.
    const ut = pickOccurrence(
      [kväll("2026-10-01", "INSTÄLLT: The Lab Torsdag"), kväll("2026-10-08")],
      "2026-10-01"
    );
    expect(ut?.event_date).toBe("2026-10-08");
  });

  it("ger null när serien tagit slut", () => {
    expect(pickOccurrence([kväll("2026-09-21")], "2026-10-01")).toBeNull();
  });

  it("struntar i rader utan datum", () => {
    expect(pickOccurrence([{ slug: "x", title: "T", event_date: null }], "2026-10-01")).toBeNull();
  });
});

describe("isCancelled", () => {
  it("känner igen inställt oavsett prickar och versaler", () => {
    expect(isCancelled("INSTÄLLT: The Lab")).toBe(true);
    expect(isCancelled("installt: the lab")).toBe(true);
    expect(isCancelled("Cancelled: The Lab")).toBe(true);
    expect(isCancelled("The Lab Torsdag")).toBe(false);
    // Ordet mitt i titeln är ingen avbokning.
    expect(isCancelled("The Lab – inställt regn?")).toBe(false);
  });
});

describe("pickTicketType", () => {
  it("matchar på sort_order när platsen är en siffra", () => {
    expect(pickTicketType(TYPER, "1")?.name).toBe("Workshop 19–20");
  });

  it("matchar på namnets början när platsen är ett ord", () => {
    // Namnen bär tider som ändras; "workshop" ska träffa "Workshop 19–20".
    expect(pickTicketType(TYPER, "workshop")?.sort_order).toBe(1);
    expect(pickTicketType(TYPER, "practica")?.sort_order).toBe(0);
    expect(pickTicketType(TYPER, "allt")?.sort_order).toBe(3);
  });

  it("bryr sig inte om versaler eller diakriter", () => {
    expect(pickTicketType(TYPER, "SOCIAL")?.sort_order).toBe(2);
  });

  it("väljer aldrig en slutsåld typ", () => {
    const slut = [typ({ name: "Workshop 19–20", sort_order: 1, capacity: 10, tickets_sold: 10 })];
    expect(pickTicketType(slut, "workshop")).toBeNull();
    expect(pickTicketType(slut, "1")).toBeNull();
  });

  it("ger null på okänd plats i stället för att gissa", () => {
    // Fel förval i dörren är värre än inget förval.
    expect(pickTicketType(TYPER, "brunch")).toBeNull();
    expect(pickTicketType(TYPER, "9")).toBeNull();
  });
});

describe("doorTarget", () => {
  it("skickar till biljettrutan med typen förvald", () => {
    expect(doorTarget("the-lab-2026-10-01", "tt-1")).toBe("/event/the-lab-2026-10-01?tt=tt-1#biljetter");
  });

  it("utan typ landar gästen ändå på biljettrutan", () => {
    expect(doorTarget("the-lab-2026-10-01", null)).toBe("/event/the-lab-2026-10-01#biljetter");
  });
});
