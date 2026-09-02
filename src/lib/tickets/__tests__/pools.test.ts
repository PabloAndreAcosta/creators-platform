import { describe, it, expect } from "vitest";
import { resolvePools, ownCapacityFor, poolNameFor } from "../pools";

const rad = (name: string, capacity: number | null, pool: string | null = null) => ({ name, capacity, pool });

describe("resolvePools", () => {
  it("slår ihop två rader med samma pottnamn till en pott", () => {
    // Bacchis fall: workshoppen tar 20, oavsett vilken av biljetterna som säljs.
    const p = resolvePools([
      rad("Workshop", 20, "Workshop"),
      rad("Workshop + social", 20, "Workshop"),
      rad("Socialdans", null),
    ]);
    expect(p).toEqual([{ name: "Workshop", capacity: 20 }]);
  });

  it("låter det MINSTA talet vinna när raderna säger olika", () => {
    // En pott som blir för stor säljer in folk som inte får plats, och det
    // felet upptäcks i dörren. För liten lämnar en stol tom.
    const p = resolvePools([
      rad("A", 20, "Workshop"),
      rad("B", 15, "Workshop"),
    ]);
    expect(p).toEqual([{ name: "Workshop", capacity: 15 }]);
  });

  it("ignorerar rader utan pottnamn", () => {
    expect(resolvePools([rad("Socialdans", 100)])).toEqual([]);
  });

  it("ignorerar pott utan kapacitet", () => {
    // En pott utan tak är ingen pott. Raden får bete sig som förut.
    expect(resolvePools([rad("Workshop", null, "Workshop")])).toEqual([]);
  });

  it("bryr sig inte om mellanslag runt namnet", () => {
    const p = resolvePools([rad("A", 20, " Workshop "), rad("B", 20, "Workshop")]);
    expect(p).toHaveLength(1);
    expect(p[0].name).toBe("Workshop");
  });

  it("hanterar flera potter på samma kväll", () => {
    const p = resolvePools([
      rad("Workshop", 20, "Workshop"),
      rad("Workshop + social", 20, "Workshop"),
      rad("VIP-bord", 4, "Bord"),
      rad("Socialdans", null),
    ]);
    expect(p).toEqual([
      { name: "Bord", capacity: 4 },
      { name: "Workshop", capacity: 20 },
    ]);
  });

  it("avvisar noll och negativa tak", () => {
    expect(resolvePools([rad("A", 0, "P"), rad("B", -5, "P")])).toEqual([]);
  });

  it("klarar en tom lista", () => {
    expect(resolvePools([])).toEqual([]);
  });
});

describe("ownCapacityFor", () => {
  it("nollar radens egen kapacitet när den tillhör en pott", () => {
    // Annars gäller två tak samtidigt, och en typ kan ta slut medan potten har
    // platser kvar — vilket ser ut som en bugg för den som står och köper.
    expect(ownCapacityFor(rad("Workshop", 20, "Workshop"))).toBeNull();
  });

  it("behåller kapaciteten för en rad utan pott", () => {
    expect(ownCapacityFor(rad("Socialdans", 100))).toBe(100);
  });
});

describe("poolNameFor", () => {
  it("normaliserar och tomt blir null", () => {
    expect(poolNameFor(rad("A", 1, "  Workshop "))).toBe("Workshop");
    expect(poolNameFor(rad("A", 1, "   "))).toBeNull();
    expect(poolNameFor(rad("A", 1, null))).toBeNull();
  });
});

import { applyPoolLimits } from "../pools";

const typ = (id: string, sold: number, poolId: string | null = null, poolCap: number | null = null) => ({
  id, name: id, price: 100, capacity: null as number | null,
  tickets_sold: sold, pool_id: poolId, pool_capacity: poolCap,
});

describe("applyPoolLimits", () => {
  it("ger pottmedlemmarna pottens tak och pottens sålda", () => {
    // 12 workshop + 8 kombinerade = 20 av 20. Båda ska visa slutsålt, inte
    // bara den som råkade sälja flest.
    const ut = applyPoolLimits([
      typ("workshop", 12, "p1", 20),
      typ("kombi", 8, "p1", 20),
      typ("social", 40),
    ]);
    expect(ut[0].capacity).toBe(20);
    expect(ut[0].tickets_sold).toBe(20);
    expect(ut[1].capacity).toBe(20);
    expect(ut[1].tickets_sold).toBe(20);
  });

  it("rör inte typer utan pott", () => {
    const ut = applyPoolLimits([typ("social", 40)]);
    expect(ut[0].capacity).toBeNull();
    expect(ut[0].tickets_sold).toBe(40);
  });

  it("gör en pottbiljett slutsåld när SYSKONET sålt slut potten", () => {
    // Kärnfallet: workshoppen har sålt 0 egna biljetter men kombinationen har
    // tagit alla 20. Workshoppen ska ändå visas som slut.
    const ut = applyPoolLimits([typ("workshop", 0, "p1", 20), typ("kombi", 20, "p1", 20)]);
    expect(ut[0].tickets_sold).toBe(20);
    expect(ut[0].capacity).toBe(20);
  });

  it("lämnar potter utan tak orörda", () => {
    const ut = applyPoolLimits([typ("a", 3, "p1", null)]);
    expect(ut[0].capacity).toBeNull();
  });

  it("klarar tom lista", () => {
    expect(applyPoolLimits([])).toEqual([]);
  });
});
