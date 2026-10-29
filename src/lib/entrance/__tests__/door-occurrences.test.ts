import { describe, expect, it } from "vitest";
import { platsFor } from "../door-occurrences";

describe("platsFor", () => {
  it("unikt sorteringsnummer blir platsen", () => {
    const alla = [
      { id: "a", name: "Hela kvällen 17–23", price: 100, sort_order: 0 },
      { id: "b", name: "Social", price: 130, sort_order: 1 },
    ];
    expect(platsFor(alla[0], alla)).toBe("0");
    expect(platsFor(alla[1], alla)).toBe("1");
  });
  it("delat nummer faller tillbaka på namnet", () => {
    const alla = [
      { id: "a", name: "Practica", price: 50, sort_order: 0 },
      { id: "b", name: "Social", price: 130, sort_order: 0 },
    ];
    expect(platsFor(alla[1], alla)).toBe("Social");
  });
});
