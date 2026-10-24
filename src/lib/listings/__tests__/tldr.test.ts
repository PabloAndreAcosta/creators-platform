import { describe, it, expect } from "vitest";
import { buildTldr } from "../tldr";

const THE_LAB = `THE LAB — ÖPPEN TRÄNING

TORSDAG 29 OKTOBER

• AW Practica kl. 17–19
• Social och practica kl. 19–23

50 kr för hela kvällen.

Den här torsdagen gör vi något annat. Ingen ledd workshop.`;

describe("buildTldr", () => {
  it("plockar punktlistan som sammanfattning", () => {
    const r = buildTldr(THE_LAB);
    expect(r.punkter).toEqual(["AW Practica kl. 17–19", "Social och practica kl. 19–23"]);
  });

  it("upprepar inte punkterna i den infällda texten", () => {
    const r = buildTldr(THE_LAB);
    expect(r.rest).not.toContain("AW Practica");
    expect(r.rest).toContain("Den här torsdagen");
    expect(r.rest).toContain("THE LAB");
  });

  it("tar första stycket när punktlista saknas", () => {
    const r = buildTldr("Vi dansar kizomba hela kvällen.\n\nTa med dig en vän.");
    expect(r.punkter).toEqual(["Vi dansar kizomba hela kvällen."]);
    expect(r.rest).toContain("Ta med dig en vän");
  });

  it("hoppar över en inledande versalrubrik", () => {
    const r = buildTldr("KIZMANIA 2026\n\nTre dagar med workshops.\n\nBiljetter släpps i mars.");
    expect(r.punkter).toEqual(["Tre dagar med workshops."]);
  });

  it("kapar långa stycken vid meningsslut utan att hugga av ord", () => {
    const lång =
      "Den här kvällen handlar om att öva tillsammans i ett rum där ingen tittar snett. " +
      "Vi börjar lugnt och bygger på efter hand, och du bestämmer själv hur mycket du vill ta in. " +
      "Alla nivåer är välkomna och ingen partner behövs.";
    const r = buildTldr(lång);
    expect(r.punkter[0].length).toBeLessThanOrEqual(221);
    expect(r.punkter[0]).not.toMatch(/\s\S{1,2}$/);
  });

  it("klarar tom och saknad text", () => {
    expect(buildTldr(null)).toEqual({ punkter: [], rest: "" });
    expect(buildTldr("   ")).toEqual({ punkter: [], rest: "" });
  });

  it("tar högst sex punkter", () => {
    const många = Array.from({ length: 9 }, (_, i) => `• rad ${i}`).join("\n");
    expect(buildTldr(många).punkter).toHaveLength(6);
  });

  it("behandlar bindestreckslistor som punktlista", () => {
    const r = buildTldr("- Practica 17–19\n- Social 19–23\n\nVälkommen.");
    expect(r.punkter).toEqual(["Practica 17–19", "Social 19–23"]);
  });
});
