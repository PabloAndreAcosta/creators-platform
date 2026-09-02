import { describe, it, expect } from "vitest";
import { sortEventsForOwner, todayInStockholm } from "../sort";

const e = (event_date: string | null, created_at = "2026-09-01T10:00:00Z") => ({ event_date, created_at });
const datum = (list: { event_date: string | null }[]) => list.map((x) => x.event_date);

describe("sortEventsForOwner", () => {
  it("lägger nästa kväll överst", () => {
    // Bacchis serie, i den ordning den faktiskt visades: 5/10 först, 7/9 sist.
    const rörigt = [e("2026-10-05"), e("2026-10-26"), e("2026-10-19"), e("2026-09-14"),
                    e("2026-09-21"), e("2026-09-28"), e("2026-10-12"), e("2026-09-07")];
    expect(datum(sortEventsForOwner(rörigt, "2026-09-03"))).toEqual([
      "2026-09-07","2026-09-14","2026-09-21","2026-09-28",
      "2026-10-05","2026-10-12","2026-10-19","2026-10-26",
    ]);
  });

  it("lägger passerade efter kommande, senast först", () => {
    // Det man vill titta tillbaka på är gårdagen, inte i fjol.
    const blandat = [e("2025-01-01"), e("2026-09-10"), e("2026-08-31"), e("2026-09-20")];
    expect(datum(sortEventsForOwner(blandat, "2026-09-03"))).toEqual([
      "2026-09-10","2026-09-20","2026-08-31","2025-01-01",
    ]);
  });

  it("räknar dagens datum som kommande", () => {
    // En kväll som är i dag har inte varit än.
    expect(datum(sortEventsForOwner([e("2026-09-02"), e("2026-09-03")], "2026-09-03")))
      .toEqual(["2026-09-03", "2026-09-02"]);
  });

  it("lägger sådant utan datum sist, senast skapat först", () => {
    const blandat = [
      e(null, "2026-01-01T00:00:00Z"),
      e("2026-09-10"),
      e(null, "2026-06-01T00:00:00Z"),
    ];
    const ut = sortEventsForOwner(blandat, "2026-09-03");
    expect(ut[0].event_date).toBe("2026-09-10");
    expect(ut[1].created_at).toBe("2026-06-01T00:00:00Z");
    expect(ut[2].created_at).toBe("2026-01-01T00:00:00Z");
  });

  it("ändrar inte listan den fick", () => {
    const original = [e("2026-10-05"), e("2026-09-07")];
    const kopia = [...original];
    sortEventsForOwner(original, "2026-09-03");
    expect(original).toEqual(kopia);
  });

  it("klarar tom lista", () => {
    expect(sortEventsForOwner([], "2026-09-03")).toEqual([]);
  });
});

describe("todayInStockholm", () => {
  it("ger svensk lokaldag, inte UTC-dag", () => {
    // 22.30 UTC den 7:e är redan den 8:e i Stockholm under sommartid. Utan
    // tidszonen hade kvällens egna event hoppat till "passerat" ett dygn fel.
    expect(todayInStockholm(new Date("2026-09-07T22:30:00Z"))).toBe("2026-09-08");
    expect(todayInStockholm(new Date("2026-09-07T12:00:00Z"))).toBe("2026-09-07");
  });
});
