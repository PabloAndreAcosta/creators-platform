import { describe, it, expect } from "vitest";
import { dedupeBy } from "../dedupe";

const byId = (x: { id: string }) => x.id;

describe("dedupeBy", () => {
  it("visar ett evenemang EN gång när det når flödet från två håll", () => {
    // Kärnfallet: användaren följer både dansaren och lokalen. Kvällen hör till
    // båda, men ska synas en gång.
    const frånKreatörer = [{ id: "kväll" }, { id: "annat" }];
    const frånLokaler = [{ id: "kväll" }];

    expect(dedupeBy([frånKreatörer, frånLokaler], byId)).toEqual([
      { id: "kväll" },
      { id: "annat" },
    ]);
  });

  it("låter första källan bestämma placeringen", () => {
    const a = [{ id: "1" }];
    const b = [{ id: "2" }, { id: "1" }];
    expect(dedupeBy([a, b], byId).map(byId)).toEqual(["1", "2"]);
  });

  it("klarar tomma källor och tom lista", () => {
    expect(dedupeBy([[], []], byId)).toEqual([]);
    expect(dedupeBy([], byId)).toEqual([]);
  });

  it("hoppar över poster utan nyckel i stället för att slå ihop dem", () => {
    // Två olika rader med tom nyckel är inte samma rad — men de går inte att
    // skilja åt heller, så de släpps hellre än slås ihop felaktigt.
    expect(dedupeBy([[{ id: "" }, { id: "a" }]], byId)).toEqual([{ id: "a" }]);
  });

  it("dubblerar inte inom en och samma källa", () => {
    expect(dedupeBy([[{ id: "a" }, { id: "a" }]], byId)).toEqual([{ id: "a" }]);
  });
});
