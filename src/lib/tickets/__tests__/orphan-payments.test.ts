import { describe, it, expect } from "vitest";
import {
  orphanCandidates,
  missingBookings,
  osedda,
  uppdateradHistorik,
  MOGNAD_SEKUNDER,
  type ChargeLike,
} from "../orphan-payments";

const NU = new Date("2026-10-17T12:00:00Z");
const sek = (d: Date) => Math.floor(d.getTime() / 1000);
const MOGEN = sek(NU) - MOGNAD_SEKUNDER - 60;
const FARSK = sek(NU) - 60;

function charge(over: Partial<ChargeLike> & { id: string }): ChargeLike {
  return {
    created: MOGEN,
    amount: 20000,
    status: "succeeded",
    refunded: false,
    payment_intent: "pi_" + over.id,
    metadata: { event_id: "2179a7cb" },
    ...over,
  };
}

describe("orphanCandidates", () => {
  it("tar med en mogen, lyckad biljettbetalning", () => {
    expect(orphanCandidates([charge({ id: "a" })], NU)).toHaveLength(1);
  });

  it("väntar ut färska betalningar", () => {
    // Webhooken är inte synkron. Utan mognadstid hade varje körning larmat om
    // betalningar som höll på att bli bokningar just då.
    expect(orphanCandidates([charge({ id: "a", created: FARSK })], NU)).toHaveLength(0);
  });

  it("ligger precis på mognadsgränsen", () => {
    const pa = sek(NU) - MOGNAD_SEKUNDER;
    expect(orphanCandidates([charge({ id: "a", created: pa })], NU)).toHaveLength(1);
    expect(orphanCandidates([charge({ id: "a", created: pa + 1 })], NU)).toHaveLength(0);
  });

  it("struntar i allt som inte är en biljettbetalning", () => {
    // Abonnemang och produkter saknar event_id och ska aldrig larma här.
    expect(orphanCandidates([charge({ id: "a", metadata: {} })], NU)).toHaveLength(0);
    expect(orphanCandidates([charge({ id: "a", metadata: null })], NU)).toHaveLength(0);
    expect(orphanCandidates([charge({ id: "a", metadata: { event_id: "" } })], NU)).toHaveLength(0);
  });

  it("struntar i misslyckade och återbetalda", () => {
    expect(orphanCandidates([charge({ id: "a", status: "failed" })], NU)).toHaveLength(0);
    expect(orphanCandidates([charge({ id: "a", refunded: true })], NU)).toHaveLength(0);
  });
});

describe("missingBookings", () => {
  it("hittar betalningen som saknar bokning", () => {
    const c = [charge({ id: "a" }), charge({ id: "b" })];
    const saknade = missingBookings(c, new Set(["pi_a"]));
    expect(saknade.map((x) => x.id)).toEqual(["b"]);
  });

  it("är tyst när allt har sin bokning", () => {
    const c = [charge({ id: "a" })];
    expect(missingBookings(c, new Set(["pi_a"]))).toHaveLength(0);
  });

  it("larmar hellre än tiger när payment_intent saknas", () => {
    // Går inte att matcha mot någon bokning. Hellre ett larm att avfärda än
    // en gäst som betalat och står utan biljett.
    const c = [charge({ id: "a", payment_intent: null })];
    expect(missingBookings(c, new Set())).toHaveLength(1);
  });
});

describe("osedda", () => {
  it("släpper bara igenom det som inte larmats förut", () => {
    const c = [charge({ id: "a" }), charge({ id: "b" })];
    expect(osedda(c, ["a"]).map((x) => x.id)).toEqual(["b"]);
  });

  it("tiger när allt redan larmats", () => {
    // Ett larm som upprepas varje timme slutar läsas — då är det lika tyst
    // som inget larm alls.
    const c = [charge({ id: "a" })];
    expect(osedda(c, ["a"])).toHaveLength(0);
  });
});

describe("uppdateradHistorik", () => {
  it("lägger nya först", () => {
    expect(uppdateradHistorik(["gammal"], [charge({ id: "ny" })])).toEqual(["ny", "gammal"]);
  });

  it("kapar så raden inte växer i evighet", () => {
    const gamla = Array.from({ length: 300 }, (_, i) => `g${i}`);
    const ut = uppdateradHistorik(gamla, [charge({ id: "ny" })], 200);
    expect(ut).toHaveLength(200);
    expect(ut[0]).toBe("ny");
    // Det som trillar av är det äldsta.
    expect(ut).not.toContain("g299");
  });
});
