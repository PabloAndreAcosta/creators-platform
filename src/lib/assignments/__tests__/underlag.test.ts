import { describe, it, expect } from "vitest";
import { buildUnderlag, underlagCsv, refundDebtOre, titleFor, type UnderlagCreator } from "../underlag";

const creator = (id: string, over: Partial<UnderlagCreator> = {}): UnderlagCreator => ({
  id,
  name: `Kreatör ${id}`,
  personalNumber: "19900101-1234",
  category: "dance",
  subcategory: "general",
  ...over,
});

describe("buildUnderlag", () => {
  const lines = [
    { id: "l2", creator_id: "a", pass_date: "2026-11-12", labour_budget_ore: 50_000 },
    { id: "l1", creator_id: "a", pass_date: "2026-11-05", labour_budget_ore: 40_000 },
    { id: "l3", creator_id: "b", pass_date: "2026-11-06", labour_budget_ore: 30_000 },
  ];

  it("en rad per kreatör med period, summa och alla fält SAMekonomi kräver", () => {
    const u = buildUnderlag(lines, new Map([["a", creator("a")], ["b", creator("b")]]), new Map());
    const a = u.rows.find((r) => r.creatorId === "a")!;
    expect(a.lineIds).toEqual(["l1", "l2"]);
    expect(a.sumOre).toBe(90_000);
    expect(a.amountOre).toBe(90_000);
    expect(a.title).toBe("Dansinstruktör");
    expect(a.description).toBe("2 uppdrag via Usha, 2026-11-05–2026-11-12");
    expect(u.totalOre).toBe(120_000);
  });

  it("skuld dras av men gör aldrig raden negativ", () => {
    const u = buildUnderlag(lines, new Map([["a", creator("a")], ["b", creator("b")]]), new Map([["b", 45_000]]));
    const b = u.rows.find((r) => r.creatorId === "b")!;
    expect(b.debtDeductedOre).toBe(30_000);
    expect(b.amountOre).toBe(0);
  });

  it("utan personnummer blockeras raden och räknas inte i summan", () => {
    const u = buildUnderlag(lines, new Map([["a", creator("a", { personalNumber: null })], ["b", creator("b")]]), new Map());
    expect(u.rows.find((r) => r.creatorId === "a")!.blocked).toBe(true);
    expect(u.totalOre).toBe(30_000);
  });
});

describe("titleFor", () => {
  it("är aldrig tom — ett tomt fält stoppade första fakturan", () => {
    expect(titleFor({ category: null, subcategory: null })).toBe("Kreatör");
    expect(titleFor({ category: "dance", subcategory: "taxi_dancer" })).toBe("Taxidansare");
    expect(titleFor({ category: "music", subcategory: "general" })).toBe("Musiker/DJ");
  });
});

describe("underlagCsv", () => {
  it("hoppar över blockerade rader och rader på noll, kronor med komma", () => {
    const u = buildUnderlag(
      [
        { id: "x", creator_id: "a", pass_date: "2026-11-05", labour_budget_ore: 73_650 },
        { id: "y", creator_id: "b", pass_date: "2026-11-05", labour_budget_ore: 10_000 },
      ],
      new Map([["a", creator("a", { name: 'Ana "DJ"; Söder' })], ["b", creator("b", { personalNumber: null })]]),
      new Map(),
    );
    const csv = underlagCsv(u.rows);
    const lines = csv.replace("﻿", "").trim().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("736,50");
    expect(lines[1]).toContain('"Ana ""DJ""; Söder"');
  });
});

describe("refundDebtOre", () => {
  it("hel återbetalning = hela lönebudgeten, delvis = samma andel", () => {
    const line = { price_ore: 100_000, labour_budget_ore: 73_600 };
    expect(refundDebtOre(line, 100_000)).toBe(73_600);
    expect(refundDebtOre(line, 50_000)).toBe(36_800);
    expect(refundDebtOre(line, 200_000)).toBe(73_600);
    expect(refundDebtOre(line, 0)).toBe(0);
  });
});
