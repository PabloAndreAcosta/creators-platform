import { describe, it, expect } from "vitest";
import { resolvePools, ownCapacityFor, parsePoolNames, applyPoolLimits } from "../pools";

const rad = (name: string, capacity: number | null, pools: string[] = []) => ({ name, capacity, pools });

/** Bacchis faktiska upplägg. */
const kvallen = [
  rad("Practica", 80, ["Practica"]),
  rad("Workshop", 30, ["Workshop"]),
  rad("Social", 100, ["Social"]),
  rad("Allt", null, ["Practica", "Workshop", "Social"]),
];

describe("parsePoolNames", () => {
  it("delar upp fritext på komma", () => {
    expect(parsePoolNames("Practica, Workshop, Social")).toEqual(["Practica", "Workshop", "Social"]);
  });

  it("bryr sig inte om mellanslag eller dubbletter", () => {
    expect(parsePoolNames("  Workshop ,Workshop,  Social ")).toEqual(["Workshop", "Social"]);
  });

  it("ger tom lista för tomt eller skräp", () => {
    expect(parsePoolNames("")).toEqual([]);
    expect(parsePoolNames("  ,  ")).toEqual([]);
    expect(parsePoolNames(null)).toEqual([]);
    expect(parsePoolNames(42)).toEqual([]);
  });
});

describe("resolvePools", () => {
  it("hittar de tre passen med rätt tak", () => {
    expect(resolvePools(kvallen)).toEqual([
      { name: "Practica", capacity: 80 },
      { name: "Social", capacity: 100 },
      { name: "Workshop", capacity: 30 },
    ]);
  });

  it("tar INTE tak från en rad som tillhör flera potter", () => {
    // Kombinationsbiljetten säger ingenting om hur stort ett enskilt pass är.
    // Skrev någon 200 i dess kapacitetsfält får det inte bli passets tak.
    const p = resolvePools([
      rad("Workshop", 30, ["Workshop"]),
      rad("Allt", 200, ["Practica", "Workshop", "Social"]),
    ]);
    expect(p).toEqual([{ name: "Workshop", capacity: 30 }]);
  });

  it("låter det minsta talet vinna när två rader säger olika", () => {
    expect(resolvePools([rad("A", 30, ["P"]), rad("B", 20, ["P"])])).toEqual([{ name: "P", capacity: 20 }]);
  });

  it("ignorerar rader utan pott och potter utan tak", () => {
    expect(resolvePools([rad("Lös", 50), rad("Utan tak", null, ["P"])])).toEqual([]);
  });
});

describe("ownCapacityFor", () => {
  it("nollar radens eget tak när den tillhör en pott", () => {
    expect(ownCapacityFor(rad("Workshop", 30, ["Workshop"]))).toBeNull();
    expect(ownCapacityFor(rad("Allt", 200, ["Practica", "Workshop"]))).toBeNull();
  });

  it("behåller taket för en rad helt utan pott", () => {
    expect(ownCapacityFor(rad("Lös", 50))).toBe(50);
  });
});

const typ = (
  id: string,
  pools: { id: string; capacity: number | null; sold: number }[] = []
) => ({ id, name: id, price: 100, capacity: null as number | null, tickets_sold: 0, pools });

describe("applyPoolLimits", () => {
  it("låter den TRÅNGASTE potten bestämma", () => {
    // Kombinationsbiljetten: practican har 55 kvar, workshoppen 5. Det är 5 som
    // gäller — man kan inte sälja en biljett till ett pass som är fullt, hur
    // gott om plats de andra än har.
    const ut = applyPoolLimits([
      typ("allt", [
        { id: "practica", capacity: 80, sold: 25 },
        { id: "workshop", capacity: 30, sold: 25 },
        { id: "social", capacity: 100, sold: 25 },
      ]),
    ]);
    expect(ut[0].capacity).toBe(30);
    expect(ut[0].tickets_sold).toBe(25);
  });

  it("visar slutsålt när EN pott är full", () => {
    const ut = applyPoolLimits([
      typ("allt", [
        { id: "workshop", capacity: 30, sold: 30 },
        { id: "social", capacity: 100, sold: 30 },
      ]),
    ]);
    // soldOut() i köpvyn frågar capacity != null && sold >= capacity.
    expect(ut[0].tickets_sold).toBeGreaterThanOrEqual(ut[0].capacity as number);
  });

  it("rör inte en typ utan potter", () => {
    const t = { ...typ("lös"), capacity: 50, tickets_sold: 10 };
    expect(applyPoolLimits([t])[0]).toEqual(t);
  });

  it("ignorerar potter utan tak", () => {
    const ut = applyPoolLimits([typ("a", [{ id: "p", capacity: null, sold: 3 }])]);
    expect(ut[0].capacity).toBeNull();
  });

  it("klarar tom lista", () => {
    expect(applyPoolLimits([])).toEqual([]);
  });
});
