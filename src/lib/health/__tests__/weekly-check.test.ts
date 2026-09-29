import { describe, it, expect } from "vitest";
import {
  granskaKvall,
  datumIslug,
  inomDagar,
  sammanfattaGaster,
  sortera,
  type KvallInput,
} from "../weekly-check";

const IDAG = "2026-10-01";

const kvall = (o: Partial<KvallInput> = {}): KvallInput => ({
  id: "l1",
  slug: "the-lab-torsdag-2026-10-08",
  title: "The Lab Torsdag",
  eventDate: "2026-10-08",
  isActive: true,
  price: 200,
  facebookEventId: "438_122",
  ticketTypeCount: 4,
  ...o,
});

describe("datumIslug", () => {
  it("plockar datumet i slutet", () => {
    expect(datumIslug("the-lab-torsdag-2026-10-08")).toBe("2026-10-08");
  });

  it("ger null när det inte finns något", () => {
    expect(datumIslug("the-lab-torsdag")).toBeNull();
    expect(datumIslug(null)).toBeNull();
  });
});

describe("granskaKvall", () => {
  it("en kväll som är i sin ordning ger ingenting", () => {
    expect(granskaKvall(kvall(), IDAG, 21)).toEqual([]);
  });

  it("FÅNGAR slug-datum som inte matchar kvällen", () => {
    // Felet som sålde biljetter till fel kväll i tre dygn.
    const a = granskaKvall(kvall({ slug: "the-lab-torsdag-2026-10-01" }), IDAG, 21);
    expect(a).toHaveLength(1);
    expect(a[0].regel).toBe("slug-datum");
    expect(a[0].allvar).toBe("blockerar");
  });

  it("fångar en kväll som inte går att köpa biljett till", () => {
    const a = granskaKvall(kvall({ price: 0, ticketTypeCount: 0 }), IDAG, 21);
    expect(a.map((x) => x.regel)).toContain("ingen-biljett");
  });

  it("gratis kväll med biljettyper är inget fel", () => {
    expect(granskaKvall(kvall({ price: 0, ticketTypeCount: 2 }), IDAG, 21)).toEqual([]);
  });

  it("fångar odelad kväll inom horisonten", () => {
    const a = granskaKvall(kvall({ facebookEventId: null }), IDAG, 21);
    expect(a.map((x) => x.regel)).toContain("odelad");
    expect(a[0].allvar).toBe("bör_rättas");
  });

  it("klagar INTE på en odelad kväll långt fram", () => {
    // En kväll i december behöver inget inlägg i oktober.
    const a = granskaKvall(
      kvall({ facebookEventId: null, eventDate: "2026-12-10", slug: "x-2026-12-10" }),
      IDAG,
      21
    );
    expect(a).toEqual([]);
  });

  it("rör inte passerade eller avpublicerade kvällar", () => {
    // Gamla event ska finnas kvar som bibliotek — de är inte fel.
    expect(granskaKvall(kvall({ eventDate: "2026-09-01", slug: "x-2026-09-01" }), IDAG, 21)).toEqual([]);
    expect(granskaKvall(kvall({ isActive: false, facebookEventId: null }), IDAG, 21)).toEqual([]);
  });
});

describe("inomDagar", () => {
  it("räknar framåt, inte bakåt", () => {
    expect(inomDagar(IDAG, "2026-10-08", 21)).toBe(true);
    expect(inomDagar(IDAG, "2026-09-30", 21)).toBe(false);
    expect(inomDagar(IDAG, "2026-11-30", 21)).toBe(false);
  });
});

describe("sammanfattaGaster", () => {
  it("tiger när det inte finns några", () => {
    expect(sammanfattaGaster(0)).toBeNull();
  });

  it("rapporterar antalet när det finns", () => {
    expect(sammanfattaGaster(12)?.detalj).toContain("12");
  });
});

describe("sortera", () => {
  it("lägger det blockerande först", () => {
    const s = sortera([
      { allvar: "bör_rättas", regel: "odelad", kvall: "B", detalj: "" },
      { allvar: "blockerar", regel: "slug-datum", kvall: "A", detalj: "" },
    ]);
    expect(s[0].allvar).toBe("blockerar");
  });
});
