import { describe, it, expect } from "vitest";
import { stuckPayouts, trolligOrsak, type PayoutRow } from "../stuck";

const NU = new Date("2026-10-05T09:00:00Z");

const rad = (o: Partial<PayoutRow> = {}): PayoutRow => ({
  listing_id: "l1",
  status: "pending",
  amount_ore: 73600,
  created_at: "2026-10-01T22:01:22Z",
  error: null,
  ...o,
});

describe("stuckPayouts", () => {
  it("tar med en pending som legat för länge", () => {
    // 1 okt → 5 okt = fyra dygn. Partnern har inte fått sina pengar.
    const ut = stuckPayouts([rad()], NU);
    expect(ut).toHaveLength(1);
    expect(ut[0].dagar).toBe(3);
    expect(ut[0].amountOre).toBe(73600);
  });

  it("låter en färsk uppskjutning vara", () => {
    // Kortpengar blir tillgängliga med någon dags fördröjning. Ett larm varje
    // natt för det normala lär man sig att ignorera.
    expect(stuckPayouts([rad({ created_at: "2026-10-04T22:00:00Z" })], NU)).toEqual([]);
  });

  it("larmar om failed direkt, oavsett ålder", () => {
    // Redan bedömt som icke-övergående. Det ska inte mogna i två dygn först.
    const ut = stuckPayouts([rad({ status: "failed", created_at: "2026-10-05T08:00:00Z" })], NU);
    expect(ut).toHaveLength(1);
  });

  it("struntar i betalda och torrkörda", () => {
    expect(
      stuckPayouts([rad({ status: "paid" }), rad({ status: "dry_run" })], NU)
    ).toEqual([]);
  });

  it("sorterar äldst först", () => {
    const ut = stuckPayouts(
      [
        rad({ listing_id: "ny", created_at: "2026-10-02T00:00:00Z" }),
        rad({ listing_id: "gammal", created_at: "2026-09-20T00:00:00Z" }),
      ],
      NU
    );
    expect(ut.map((x) => x.listingId)).toEqual(["gammal", "ny"]);
  });

  it("tål ett trasigt datum utan att krascha", () => {
    expect(() => stuckPayouts([rad({ created_at: "inte-ett-datum" })], NU)).not.toThrow();
  });
});

describe("trolligOrsak", () => {
  it("översätter Stripes saldotext till en åtgärd", () => {
    const orsak = trolligOrsak(
      "You have insufficient funds in your Stripe account. One likely reason you have insufficient funds is that your funds are automatically being paid out"
    );
    expect(orsak).toContain("manuella utbetalningar");
  });

  it("gissar inte på fel den inte känner igen", () => {
    expect(trolligOrsak("Something else went wrong")).toBeNull();
    expect(trolligOrsak(null)).toBeNull();
  });
});
