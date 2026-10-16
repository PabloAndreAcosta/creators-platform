import { describe, it, expect } from "vitest";
import {
  decideSupplement,
  inomFonster,
  supplementTransferGroup,
  KOMPLETTERING_FONSTER_DAGAR,
} from "../supplement";
import { splitEventRevenue } from "../split";

/**
 * Kompletterande avräkning.
 *
 * Det verkliga fallet som drev fram funktionen: The Lab torsdag 15 oktober
 * 2026. Avräkningen betalade 724 kr på ett underlag av 1 810 kr. Dagen efter
 * flyttades en biljett på 200 kr in på kvällen, och de pengarna hade aldrig
 * nått Bacchi utan en komplettering.
 */

const LISTING = "2179a7cb-7e60-4268-a994-5e8a1a98fa94";

/** Partnerandelen för ett brutto, med Bacchis villkor: 50 % efter 25 % moms. */
function andel(grossOre: number, refundedOre = 0) {
  return splitEventRevenue({ grossOre, refundedOre, vatRate: 0.25, partnerPercent: 50 });
}

describe("decideSupplement", () => {
  it("räknar fram mellanskillnaden när en biljett tillkommit efter avräkningen", () => {
    // 1 810 kr betalades ut som 724 kr. Nu är kvällen värd 2 010 kr.
    const ut = decideSupplement({
      split: andel(201000),
      alreadyPaidOre: 72400,
      primaryStatus: "paid",
    });

    expect(ut.kind).toBe("due");
    if (ut.kind !== "due") return;
    expect(ut.dueOre).toBe(80400);
    expect(ut.deltaOre).toBe(8000); // 80 kr — precis 200 kr minus moms, delat lika
  });

  it("säger balanserad när inget har ändrats", () => {
    const ut = decideSupplement({
      split: andel(181000),
      alreadyPaidOre: 72400,
      primaryStatus: "paid",
    });

    expect(ut.kind).toBe("balanced");
  });

  it("rättar ALDRIG en överbetalning automatiskt", () => {
    // En återbetalning efter avräkningen gör att partnern fått för mycket.
    // Att dra tillbaka pengar från någons konto är inget ett nattjobb gör.
    const ut = decideSupplement({
      split: andel(181000, 20000),
      alreadyPaidOre: 72400,
      primaryStatus: "paid",
    });

    expect(ut.kind).toBe("overpaid");
    if (ut.kind !== "overpaid") return;
    expect(ut.excessOre).toBeGreaterThan(0);
    expect(ut.dueOre).toBeLessThan(ut.alreadyPaidOre);
  });

  it("hoppar över kvällar där ursprungsavräkningen inte är betald", () => {
    for (const status of ["pending", "failed", "dry_run"]) {
      const ut = decideSupplement({
        split: andel(201000),
        alreadyPaidOre: 0,
        primaryStatus: status,
      });
      expect(ut.kind).toBe("skip");
    }
  });

  it("hoppar över kvällar som aldrig avräknats", () => {
    const ut = decideSupplement({
      split: andel(201000),
      alreadyPaidOre: 0,
      primaryStatus: null,
    });

    expect(ut.kind).toBe("skip");
    if (ut.kind !== "skip") return;
    expect(ut.reason).toContain("ingen ursprunglig");
  });

  it("betalar bara mellanskillnaden, aldrig hela beloppet igen", () => {
    const ut = decideSupplement({
      split: andel(201000),
      alreadyPaidOre: 72400,
      primaryStatus: "paid",
    });

    if (ut.kind !== "due") throw new Error("förväntade due");
    // Det farliga felet vore att föra över hela 804 kr en andra gång.
    expect(ut.deltaOre).toBeLessThan(ut.dueOre);
    expect(ut.alreadyPaidOre + ut.deltaOre).toBe(ut.dueOre);
  });

  it("tar hänsyn till tidigare kompletteringar", () => {
    // Första kompletteringen gav 80 kr. Sedan kom ytterligare 200 kr in.
    const ut = decideSupplement({
      split: andel(221000),
      alreadyPaidOre: 72400 + 8000,
      primaryStatus: "paid",
    });

    if (ut.kind !== "due") throw new Error("förväntade due");
    expect(ut.deltaOre).toBe(8000);
    expect(ut.dueOre).toBe(88400);
  });

  it("avvisar orimlig summa redan utbetalt", () => {
    for (const belopp of [-1, NaN, Infinity]) {
      const ut = decideSupplement({
        split: andel(201000),
        alreadyPaidOre: belopp,
        primaryStatus: "paid",
      });
      expect(ut.kind).toBe("skip");
    }
  });

  it("en kväll utan intäkt ger ingen komplettering", () => {
    const ut = decideSupplement({ split: andel(0), alreadyPaidOre: 0, primaryStatus: "paid" });
    expect(ut.kind).toBe("balanced");
  });
});

describe("supplementTransferGroup", () => {
  it("skiljer sig från ursprungsavräkningens grupp", () => {
    // Delade de grupp skulle ursprungsöverföringen hittas som "redan gjord"
    // och mellanskillnaden aldrig gå iväg.
    expect(supplementTransferGroup(LISTING, 1)).not.toBe(`settlement_${LISTING}`);
  });

  it("ger varje komplettering en egen grupp", () => {
    expect(supplementTransferGroup(LISTING, 1)).not.toBe(supplementTransferGroup(LISTING, 2));
  });
});

describe("inomFonster", () => {
  it("släpper igenom gårdagen", () => {
    expect(inomFonster("2026-10-15", "2026-10-16")).toBe(true);
  });

  it("släpper igenom kvällens egen dag", () => {
    expect(inomFonster("2026-10-16", "2026-10-16")).toBe(true);
  });

  it("stänger ute en kväll äldre än fönstret", () => {
    expect(inomFonster("2026-09-01", "2026-10-16")).toBe(false);
  });

  it("stänger ute kommande kvällar", () => {
    // En kväll som inte varit har inget att komplettera.
    expect(inomFonster("2026-10-22", "2026-10-16")).toBe(false);
  });

  it("ligger precis på gränsen", () => {
    expect(inomFonster("2026-09-16", "2026-10-16", 30)).toBe(true);
    expect(inomFonster("2026-09-15", "2026-10-16", 30)).toBe(false);
  });

  it("avvisar trasiga datum", () => {
    expect(inomFonster("inte ett datum", "2026-10-16")).toBe(false);
    expect(inomFonster("2026-10-15", "")).toBe(false);
  });

  it("fönstret är 30 dagar", () => {
    expect(KOMPLETTERING_FONSTER_DAGAR).toBe(30);
  });
});
