/**
 * Scenarier för skuggkörningen.
 *
 * Varje scenario är ett påhittat men typiskt fall — en kreatör, ett antal
 * pass — som vi vill se räknat innan något beslut tas. Riktiga kvällar läses
 * av skriptet scripts/payroll-shadow.ts direkt ur databasen och hamnar
 * aldrig här: repot är publikt.
 *
 * Födelseår är valda för att träffa avgiftsreglerna, inte riktiga personer.
 */

import type { ShadowCreator, ShadowPass } from "./shadow";

export interface Scenario {
  key: string;
  title: string;
  /** Vad scenariot ska visa, och vilket beslut det matar. */
  question: string;
  creator: ShadowCreator;
  passes: ShadowPass[];
  /** Dagen LAS-fönstret räknas bakåt från. */
  today: string;
  /** Sträcker sig in i år utan inlagda satser — räknas som projektion. */
  projectMissingYears?: boolean;
}

/** Samma veckodag i n veckor från start, som ISO-datum. */
export function weekly(startIso: string, weeks: number, labourBudgetOre: number): ShadowPass[] {
  const out: ShadowPass[] = [];
  const d = new Date(`${startIso}T00:00:00Z`);
  for (let i = 0; i < weeks; i++) {
    out.push({ date: d.toISOString().slice(0, 10), labourBudgetOre });
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return out;
}

const KLASS = 45_000; // 450 kr, typexemplet från dialogen med SAMgruppen.

export const SCENARIOS: Scenario[] = [
  {
    key: "forsta-fakturan",
    title: "Ett enda pass, 368 kr",
    question:
      "Stämmer vår motor mot SAMekonomis första skarpa lönebesked? Fyll i deras siffror när besked kommit.",
    creator: { birthYear: 1990 },
    passes: [{ date: "2026-10-01", labourBudgetOre: 36_800 }],
    today: "2026-10-31",
  },
  {
    key: "varje-torsdag",
    title: "Instruktör varje torsdag i 18 månader",
    question: "När slår LAS 5 a § till, och hur långt i förväg varnar vi?",
    creator: { birthYear: 1990 },
    passes: weekly("2026-11-05", 78, KLASS),
    today: "2028-04-27",
    projectMissingYears: true,
  },
  {
    key: "ung-kreator",
    title: "Kreatör född 2005, fyra pass i månaden",
    question: "Vad ger den sänkta ungdomsavgiften i handen jämfört med full avgift?",
    creator: { birthYear: 2005 },
    passes: weekly("2026-11-05", 4, KLASS),
    today: "2026-11-30",
  },
  {
    key: "fyllt-67",
    title: "Kreatör född 1955",
    question: "Hur mycket mer blir kvar när bara ålderspensionsavgiften betalas?",
    creator: { birthYear: 1955 },
    passes: weekly("2026-11-05", 4, KLASS),
    today: "2026-11-30",
  },
  {
    key: "sen-aterbetalning",
    title: "Kvällen återbetalas efter att lönen gått ut",
    question: "Kvittas skulden mot nästa pass, och vad står Usha för under tiden?",
    creator: { birthYear: 1990 },
    passes: [
      { date: "2026-11-05", labourBudgetOre: KLASS, lateRefundOre: KLASS },
      { date: "2026-11-12", labourBudgetOre: KLASS },
      { date: "2026-11-19", labourBudgetOre: KLASS },
    ],
    today: "2026-11-30",
  },
  {
    key: "jamkad",
    title: "Student med jämkning till 0 %",
    question: "Hur ser lönen ut när kreatören har beslut om jämkning eller låg tabellskatt?",
    creator: { birthYear: 2001, withholdingRate: 0 },
    passes: weekly("2026-11-05", 4, KLASS),
    today: "2026-11-30",
  },
];
