import { describe, it, expect } from "vitest";
import { collapseSeries, type UserMatch } from "../user-matches";

/**
 * Seriegruppering i "För dig".
 *
 * Bakgrunden: varje kväll är en egen rad i listings, så The Lab Torsdag med
 * åtta tillfällen kunde ta tre av sex platser i flödet med samma titel. Den
 * publika sidan grupperade redan, rekommendationerna gjorde det inte.
 */

const TODAY = new Date("2026-10-15T00:00:00");

function match(over: Partial<UserMatch> & { id: string }): UserMatch {
  return {
    title: "The Lab Torsdag",
    description: null,
    category: "dance",
    price: 50,
    duration_minutes: null,
    event_tier: "a",
    event_date: null,
    event_location: "Stockholm",
    image_url: null,
    listing_type: null,
    created_at: "2026-09-01T00:00:00Z",
    creator: { id: "c1", name: "Pablo", avatar: null },
    bookingCount: 0,
    score: 10,
    match_reasons: [],
    series_id: null,
    more_occurrences: 0,
    ...over,
  };
}

describe("collapseSeries", () => {
  it("slår ihop en series tillfällen till ett kort", () => {
    const out = collapseSeries(
      [
        match({ id: "a", series_id: "s1", event_date: "2026-10-22" }),
        match({ id: "b", series_id: "s1", event_date: "2026-10-29" }),
        match({ id: "c", series_id: "s1", event_date: "2026-11-05" }),
      ],
      TODAY
    );

    expect(out).toHaveLength(1);
    expect(out[0].more_occurrences).toBe(2);
  });

  it("väljer nästa KOMMANDE tillfälle, inte det först rankade", () => {
    const out = collapseSeries(
      [
        // Högst poäng men längst bort — får inte representera serien.
        match({ id: "sen", series_id: "s1", event_date: "2026-12-03", score: 99 }),
        match({ id: "snart", series_id: "s1", event_date: "2026-10-22", score: 10 }),
      ],
      TODAY
    );

    expect(out[0].id).toBe("snart");
  });

  it("behåller gruppens högsta poäng så ihopslagningen inte trycker ner serien", () => {
    const out = collapseSeries(
      [
        match({ id: "sen", series_id: "s1", event_date: "2026-12-03", score: 99 }),
        match({ id: "snart", series_id: "s1", event_date: "2026-10-22", score: 10 }),
      ],
      TODAY
    );

    expect(out[0].score).toBe(99);
  });

  it("faller tillbaka på senast passerade när serien saknar kommande kvällar", () => {
    const out = collapseSeries(
      [
        match({ id: "gammal", series_id: "s1", event_date: "2026-08-01" }),
        match({ id: "mindre-gammal", series_id: "s1", event_date: "2026-09-24" }),
      ],
      TODAY
    );

    expect(out[0].id).toBe("mindre-gammal");
    expect(out[0].more_occurrences).toBe(1);
  });

  it("räknar dagens kväll som kommande", () => {
    const out = collapseSeries(
      [
        match({ id: "idag", series_id: "s1", event_date: "2026-10-15" }),
        match({ id: "imorgon", series_id: "s1", event_date: "2026-10-16" }),
      ],
      TODAY
    );

    expect(out[0].id).toBe("idag");
  });

  it("grupperar ALDRIG ihop fristående utbud utan serie", () => {
    const out = collapseSeries(
      [
        match({ id: "a", series_id: null, title: "Kostrådgivning" }),
        match({ id: "b", series_id: null, title: "Personlig träning" }),
        match({ id: "c", series_id: null, title: "PT - Duo" }),
      ],
      TODAY
    );

    expect(out).toHaveLength(3);
    expect(out.every((m) => m.more_occurrences === 0)).toBe(true);
  });

  it("håller isär olika serier", () => {
    const out = collapseSeries(
      [
        match({ id: "a", series_id: "torsdag", event_date: "2026-10-22" }),
        match({ id: "b", series_id: "torsdag", event_date: "2026-10-29" }),
        match({ id: "c", series_id: "tisdag", event_date: "2026-10-20" }),
      ],
      TODAY
    );

    expect(out).toHaveLength(2);
    expect(out.map((m) => m.series_id).sort()).toEqual(["tisdag", "torsdag"]);
  });

  it("ordnar om efter poäng när en syskonkväll lyft gruppen", () => {
    const out = collapseSeries(
      [
        match({ id: "ensam", series_id: null, score: 50 }),
        match({ id: "svag", series_id: "s1", event_date: "2026-10-22", score: 10 }),
        match({ id: "stark", series_id: "s1", event_date: "2026-11-19", score: 80 }),
      ],
      TODAY
    );

    // Serien representeras av sin närmaste kväll men bär syskonets poäng,
    // och hamnar därför före det fristående utbudet.
    expect(out.map((m) => m.id)).toEqual(["svag", "ensam"]);
  });

  it("klarar tillfällen helt utan datum", () => {
    const out = collapseSeries(
      [
        match({ id: "a", series_id: "s1", event_date: null }),
        match({ id: "b", series_id: "s1", event_date: null }),
      ],
      TODAY
    );

    expect(out).toHaveLength(1);
    expect(out[0].more_occurrences).toBe(1);
  });
});
