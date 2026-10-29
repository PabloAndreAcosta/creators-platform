import { describe, it, expect } from "vitest";
import { cleanDjName, cleanDjLink, rankWishes, DJ_WISH_GOAL } from "../dj-wishes";

describe("DJ-önskemål", () => {
  it("namn städas och kräver två tecken", () => {
    expect(cleanDjName("  DJ   Kizz  ")).toBe("DJ Kizz");
    expect(cleanDjName("x")).toBeNull();
  });
  it("bara http(s)-länkar", () => {
    expect(cleanDjLink("https://instagram.com/djkizz")).toBe("https://instagram.com/djkizz");
    expect(cleanDjLink("javascript:alert(1)")).toBeNull();
    expect(cleanDjLink("")).toBeNull();
  });
  it("flest röster först, dolda bort, målet vid 50", () => {
    const r = rankWishes([
      { id: "a", name: "A", status: "open", votes: 12 },
      { id: "b", name: "B", status: "open", votes: DJ_WISH_GOAL },
      { id: "c", name: "C", status: "hidden", votes: 99 },
      { id: "d", name: "D", status: "booked", votes: 3 },
    ]);
    expect(r.map((x) => x.id)).toEqual(["b", "a", "d"]);
    expect(r.find((x) => x.id === "b")!.reachedGoal).toBe(true);
    expect(r.find((x) => x.id === "a")!.reachedGoal).toBe(false);
    expect(r.find((x) => x.id === "d")!.reachedGoal).toBe(true);
  });
});
