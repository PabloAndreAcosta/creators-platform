import { describe, it, expect } from "vitest";
import { destinationsFor } from "../registry";

describe("behörigheter kan låsa upp enskilda menyval", () => {
  it("visar inte lokalens förfrågningar för en besökare", () => {
    const vagar = destinationsFor("customer", "more").map((d) => d.path);
    expect(vagar).not.toContain("/app/venue-requests");
  });

  it("visar dem för en besökare som sköter en lokals sida", () => {
    // En teammedlem kan ha rollen customer men hålla `page` för en lokal.
    // Utan upplåsningen hittar hen aldrig dit, och behörigheten blir en
    // kryssruta utan verkan.
    const vagar = destinationsFor("customer", "more", ["/app/venue-requests"]).map((d) => d.path);
    expect(vagar).toContain("/app/venue-requests");
  });

  it("låser inte upp något annat på köpet", () => {
    // Undantaget ska vara smalt: en sökväg, inte en andra behörighetsmodell.
    const utan = destinationsFor("customer", "more").map((d) => d.path);
    const med = destinationsFor("customer", "more", ["/app/venue-requests"]).map((d) => d.path);
    expect(med.filter((p) => !utan.includes(p))).toEqual(["/app/venue-requests"]);
  });

  it("påverkar inte lokalens egen vy", () => {
    const utan = destinationsFor("venue", "more").map((d) => d.path);
    const med = destinationsFor("venue", "more", ["/app/venue-requests"]).map((d) => d.path);
    expect(med).toEqual(utan);
  });

  it("en okänd sökväg låser inte upp något", () => {
    const utan = destinationsFor("customer", "more").map((d) => d.path);
    const med = destinationsFor("customer", "more", ["/finns-inte"]).map((d) => d.path);
    expect(med).toEqual(utan);
  });
});
