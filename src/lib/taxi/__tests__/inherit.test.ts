import { describe, it, expect } from "vitest";
import { inheritSeriesShifts, planInheritedShifts, type TemplateShift } from "../inherit";

const U = "15d852ed-1f33-446f-9bcb-821c2444c84f";
// The Lab 19 nov (vintertid, UTC+1): 17–19, 19–21, 21–23, taxi + instruktör à 2.
const TEMPLATE: TemplateShift[] = [17, 19, 21].flatMap((h) =>
  ["taxi_dancer", "instructor"].map((role) => ({
    role,
    role_label: null,
    capacity: 2,
    pay_ore: 0,
    created_by: U,
    starts_at: `2026-11-19T${String(h - 1).padStart(2, "0")}:00:00.000Z`,
    ends_at: `2026-11-19T${String(h + 1).padStart(2, "0")}:00:00.000Z`,
  })),
);

describe("planInheritedShifts", () => {
  it("flyttar passen till den nya kvällen med samma väggklocka", () => {
    const rows = planInheritedShifts({ id: "ny", event_date: "2026-12-03", is_practica: true }, TEMPLATE);
    expect(rows).toHaveLength(6);
    expect(rows.map((r) => r.starts_at)).toContain("2026-12-03T17:00:00+01:00");
    expect(rows.every((r) => r.listing_id === "ny" && r.capacity === 2 && r.pay_ore === 0 && r.created_by === U)).toBe(true);
  });

  it("håller väggklockan över omställningen till sommartid", () => {
    const rows = planInheritedShifts({ id: "ny", event_date: "2027-04-01", is_practica: true }, TEMPLATE);
    expect(rows.map((r) => r.starts_at)).toContain("2027-04-01T17:00:00+02:00");
  });

  it("DJ utan ersättning ärvs bara till en practica", () => {
    const dj: TemplateShift = { ...TEMPLATE[0], role: "dj", capacity: 1 };
    expect(planInheritedShifts({ id: "a", event_date: "2026-12-03", is_practica: false }, [dj])).toHaveLength(0);
    expect(planInheritedShifts({ id: "b", event_date: "2026-12-03", is_practica: true }, [dj])).toHaveLength(1);
  });

  it("hoppar över okända roller och dubbletter", () => {
    const rows = planInheritedShifts({ id: "x", event_date: "2026-12-03", is_practica: true }, [
      TEMPLATE[0],
      TEMPLATE[0],
      { ...TEMPLATE[0], role: "okänd" },
    ]);
    expect(rows).toHaveLength(1);
  });
});

/** Minimal Supabase-attrapp: filtrerar tabellerna i minnet och sparar inserts. */
function fakeDb(tables: Record<string, Record<string, unknown>[]>) {
  const inserted: Record<string, unknown>[] = [];
  const from = (table: string) => {
    let rows = [...(tables[table] ?? [])];
    let desc = false;
    const q = {
      select: () => q,
      not: (c: string) => ((rows = rows.filter((r) => r[c] != null)), q),
      eq: (c: string, v: unknown) => ((rows = rows.filter((r) => r[c] === v)), q),
      gte: (c: string, v: string) => ((rows = rows.filter((r) => String(r[c]) >= v)), q),
      in: (c: string, v: unknown[]) => ((rows = rows.filter((r) => v.includes(r[c]))), q),
      order: (_c: string, o: { ascending: boolean }) => ((desc = !o.ascending), q),
      insert: async (r: Record<string, unknown>[]) => (inserted.push(...r), { error: null }),
      then: (ok: (v: { data: unknown; error: null }) => unknown) => {
        const out = desc ? [...rows].sort((a, b) => String(b.event_date).localeCompare(String(a.event_date))) : rows;
        return Promise.resolve({ data: out, error: null }).then(ok);
      },
    };
    return q;
  };
  return { db: { from } as never, inserted };
}

describe("inheritSeriesShifts", () => {
  const NOW = new Date("2026-11-10T10:00:00Z");
  const S = "serie";
  const lst = (id: string, date: string, created: string, extra: Record<string, unknown> = {}) => ({
    id, title: "The Lab Torsdag", event_date: date, is_practica: true, series_id: S, user_id: U,
    is_active: true, created_at: created, ...extra,
  });

  it("ger nya kvällar utan pass seriens senaste pass, men rör inte gamla, inställda eller utkast", async () => {
    const { db, inserted } = fakeDb({
      listings: [
        lst("gammal", "2026-11-19", "2026-10-28T16:00:00Z"),
        lst("ny1", "2026-11-26", "2026-11-10T09:13:00Z"),
        lst("ny2", "2026-12-03", "2026-11-10T09:13:00Z"),
        lst("installd", "2026-12-10", "2026-11-10T09:13:00Z", { title: "INSTÄLLT: The Lab" }),
        lst("utkast", "2026-12-17", "2026-11-10T09:13:00Z", { is_active: false }),
        lst("tomgammal", "2026-12-24", "2026-10-01T09:00:00Z"),
      ],
      taxi_shifts: TEMPLATE.map((t) => ({ ...t, listing_id: "gammal" })),
    });
    const r = await inheritSeriesShifts(db, { today: "2026-11-10", now: NOW });
    expect(r).toEqual({ evenings: 2, shifts: 12 });
    expect(new Set(inserted.map((i) => i.listing_id))).toEqual(new Set(["ny1", "ny2"]));
  });

  it("lämnar en ny kväll som redan har pass, och en serie utan pass, i fred", async () => {
    const { db, inserted } = fakeDb({
      listings: [lst("ny1", "2026-11-26", "2026-11-10T09:13:00Z"), lst("ny2", "2026-12-03", "2026-11-10T09:13:00Z")],
      taxi_shifts: [{ ...TEMPLATE[0], listing_id: "ny1" }],
    });
    const r = await inheritSeriesShifts(db, { today: "2026-11-10", now: NOW });
    expect(r.evenings).toBe(1);
    expect(inserted.every((i) => i.listing_id === "ny2")).toBe(true);

    const empty = fakeDb({ listings: [lst("ny", "2026-11-26", "2026-11-10T09:13:00Z")], taxi_shifts: [] });
    expect(await inheritSeriesShifts(empty.db, { today: "2026-11-10", now: NOW })).toEqual({ evenings: 0, shifts: 0 });
  });
});
