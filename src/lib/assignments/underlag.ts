/**
 * Underlaget till SAMekonomi: en rad per kreatör och period.
 *
 * SAMekonomis samlingsfaktura har en rad per ersättningsmottagare, och raden
 * går inte att skicka utan fyra fält: personnummer, belopp exkl. moms,
 * "Beskriv ditt arbete" och "Befattning/titel/yrke". Två tomma fält stoppade
 * den första fakturan i veckor (felet syns bara inne i radens dialog). Därför
 * räknas tre av dem fram här.
 *
 * Personnumret har Usha INTE: BankID-numret sparas bara som hash. Det fylls i
 * i SAMekonomi, som känner igen sina medlemmar på det. En kreatör som inte
 * verifierat sig med BankID flaggas, så att ingen lön går till en identitet
 * vi aldrig bekräftat.
 *
 * Beloppet är lönebudgeten — det SAMekonomi fakturerar Usha för, och som de
 * drar sina 2 %, arbetsgivaravgift och skatt ur. Skuld från återbetalningar
 * efter tidigare underlag dras av här (lib/payouts/creator-debt.ts).
 *
 * Ren funktion. Sidan och CSV-routen läser och skriver.
 */

import { applyDebt } from "@/lib/payouts/creator-debt";

export interface UnderlagLine {
  id: string;
  creator_id: string;
  pass_date: string;
  labour_budget_ore: number;
}

export interface UnderlagCreator {
  id: string;
  name: string | null;
  /** Har verifierat sig med Mobilt BankID. */
  verified: boolean;
  category: string | null;
  subcategory: string | null;
}

export interface UnderlagRow {
  creatorId: string;
  name: string;
  title: string;
  description: string;
  firstDate: string;
  lastDate: string;
  lineIds: string[];
  /** Summa lönebudget före skuldavdrag. */
  sumOre: number;
  debtDeductedOre: number;
  /** Det som ska stå på raden i samlingsfakturan, exkl. moms. */
  amountOre: number;
  /** Raden kan inte skickas: kreatören har inte verifierat sig med BankID. */
  blocked: boolean;
}

const TITLES: Record<string, string> = {
  dance: "Dansinstruktör",
  music: "Musiker/DJ",
  fitness: "Träningsinstruktör",
  photo: "Fotograf",
};

/** Befattningen SAMekonomi kräver. Hellre generell än tom. */
export function titleFor(c: Pick<UnderlagCreator, "category" | "subcategory">): string {
  if (c.subcategory === "taxi_dancer") return "Taxidansare";
  return (c.category && TITLES[c.category]) || "Kreatör";
}

export function buildUnderlag(
  lines: readonly UnderlagLine[],
  creators: ReadonlyMap<string, UnderlagCreator>,
  debtByCreator: ReadonlyMap<string, number>,
): { rows: UnderlagRow[]; totalOre: number } {
  const byCreator = new Map<string, UnderlagLine[]>();
  for (const l of lines) {
    const list = byCreator.get(l.creator_id) ?? [];
    list.push(l);
    byCreator.set(l.creator_id, list);
  }

  const rows: UnderlagRow[] = [];
  for (const [creatorId, list] of byCreator) {
    list.sort((a, b) => a.pass_date.localeCompare(b.pass_date));
    const c = creators.get(creatorId);
    const sumOre = list.reduce((a, l) => a + l.labour_budget_ore, 0);
    const debt = applyDebt({ grossOre: sumOre, debtOre: debtByCreator.get(creatorId) ?? 0 });
    const firstDate = list[0].pass_date;
    const lastDate = list[list.length - 1].pass_date;
    const title = titleFor(c ?? { category: null, subcategory: null });
    const period = firstDate === lastDate ? firstDate : `${firstDate}–${lastDate}`;
    rows.push({
      creatorId,
      name: c?.name || "Okänd kreatör",
      title,
      description: `${list.length === 1 ? "Uppdrag" : `${list.length} uppdrag`} via Usha, ${period}`,
      firstDate,
      lastDate,
      lineIds: list.map((l) => l.id),
      sumOre,
      debtDeductedOre: debt.deductedOre,
      amountOre: debt.payableOre,
      blocked: !c?.verified,
    });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name, "sv"));
  return { rows, totalOre: rows.filter((r) => !r.blocked).reduce((a, r) => a + r.amountOre, 0) };
}

/** Semikolonseparerad CSV, som svenska Excel öppnar utan import. Belopp i kronor. */
export function underlagCsv(rows: readonly UnderlagRow[]): string {
  const esc = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const kr = (ore: number) => (ore / 100).toFixed(2).replace(".", ",");
  // Personnumret har vi inte (bara som hash) — kolumnen finns så att den fylls i.
  const head = ["Namn", "Personnummer (fyll i)", "Befattning/titel/yrke", "Beskriv ditt arbete", "Från", "Till", "Belopp exkl. moms (kr)"];
  const body = rows
    .filter((r) => !r.blocked && r.amountOre > 0)
    .map((r) =>
      [r.name, "", r.title, r.description, r.firstDate, r.lastDate, kr(r.amountOre)].map(esc).join(";"),
    );
  // BOM så att Excel läser å, ä och ö rätt.
  return "﻿" + [head.join(";"), ...body].join("\r\n") + "\r\n";
}

/**
 * Skulden en återbetalning ger när underlaget redan skickats: samma andel av
 * lönebudgeten som återbetalningen är av priset. Golv, så att kvittningen
 * aldrig blir större än det som faktiskt gick till lön.
 */
export function refundDebtOre(line: { price_ore: number; labour_budget_ore: number }, refundedOre: number): number {
  if (line.price_ore <= 0 || refundedOre <= 0) return 0;
  const share = Math.min(1, refundedOre / line.price_ore);
  return Math.floor(line.labour_budget_ore * share);
}
