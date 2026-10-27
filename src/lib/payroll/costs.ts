/**
 * Vad det kostar att ha lönen i egen regi — utöver lönen själv.
 *
 * Lönemotorn räknar det lagen kräver per pass: lön, 12 % semesterersättning
 * och arbetsgivaravgift (där den lagstadgade arbetsskadeförsäkringen redan
 * ingår). Det som SAMekonomis 2 % också täcker är resten: försäkringar,
 * system, bankavgifter och någons tid. Den här tabellen är den resten, så att
 * jämförelsen blir rättvis.
 *
 * Varje post säger hur säker siffran är. "offert" betyder att beloppet är en
 * uppskattning tills någon fått ett pris i handen — rapporten skriver ut det.
 * Belopp i ÖRE, kontrollerade 2026-10-27.
 */

export type CostSource =
  /** Står i ett avtal vi har eller i en officiell prislista. */
  | "verifierad"
  /** Publicerat av någon annan än leverantören, eller för en annan avtalstyp. */
  | "tredjepart"
  /** Vår bedömning. Måste ersättas med en offert före beslut. */
  | "offert";

export type CostItem =
  | { key: string; label: string; source: CostSource; kind: "per_month"; ore: number }
  | { key: string; label: string; source: CostSource; kind: "per_employee_month"; ore: number }
  | { key: string; label: string; source: CostSource; kind: "per_payout"; ore: number }
  | { key: string; label: string; source: CostSource; kind: "per_signing"; ore: number }
  | { key: string; label: string; source: CostSource; kind: "share_of_gross"; rate: number };

/**
 * Egen regi med egen lönemotor, AGI via Skatteverkets API och lönebesked i
 * appen. Inget lönesystem behövs då — Fortnox Lön är alternativet nedan.
 */
export const OWN_REGIME_COSTS: CostItem[] = [
  {
    key: "fora",
    label: "TFA + TGL via Fora (frivilligt utan kollektivavtal)",
    // 0,01 % + 0,10 % av lönesumman: 2026 års premier MED kollektivavtal.
    // Fora säljer till arbetsgivare utan avtal, men premien är inte bekräftad.
    source: "tredjepart",
    kind: "share_of_gross",
    rate: 0.0011,
  },
  {
    key: "ansvar",
    label: "Ansvarsförsäkring för pass hos kund (ca 3 000–11 000 kr/år)",
    source: "offert",
    kind: "per_month",
    ore: 50_000,
  },
  {
    key: "bankid",
    label: "BankID-underskrift av ramavtalet, en gång per kreatör",
    // Nordea-avtalet: 0,40 kr per underskrift.
    source: "verifierad",
    kind: "per_signing",
    ore: 40,
  },
  {
    key: "bank",
    label: "Bankavgift per löneutbetalning (betalfil)",
    source: "offert",
    kind: "per_payout",
    ore: 200,
  },
  {
    key: "redovisning",
    label: "Redovisningskonsult: lönebokföring, ca 1 h/mån",
    source: "offert",
    kind: "per_month",
    ore: 120_000,
  },
  {
    key: "tid",
    label: "Egen tid: AGI-signering + godkänna betalfil, ca 1 h/mån",
    source: "offert",
    kind: "per_month",
    ore: 50_000,
  },
];

/** Om lönesystemet köps i stället för att byggas. Ersätter inte posterna ovan. */
export const FORTNOX_LON_COSTS: CostItem[] = [
  { key: "fortnox", label: "Fortnox Lön, grundavgift", source: "tredjepart", kind: "per_month", ore: 19_900 },
  { key: "fortnox_anst", label: "Fortnox Lön, per anställd med lön", source: "tredjepart", kind: "per_employee_month", ore: 2_500 },
  { key: "fortnox_kivra", label: "Lönebesked via Kivra", source: "tredjepart", kind: "per_payout", ore: 500 },
];

export interface MonthVolume {
  grossOre: number;
  /** Olika personer som fått lön under månaden. */
  employees: number;
  payouts: number;
  /** Nya ramavtal som signerats. */
  signings: number;
}

export interface CostLine {
  key: string;
  label: string;
  source: CostSource;
  ore: number;
}

export function monthlyCost(items: readonly CostItem[], v: MonthVolume): { totalOre: number; lines: CostLine[] } {
  const lines = items.map((i): CostLine => {
    let ore: number;
    switch (i.kind) {
      case "per_month":
        ore = i.ore;
        break;
      case "per_employee_month":
        ore = i.ore * v.employees;
        break;
      case "per_payout":
        ore = i.ore * v.payouts;
        break;
      case "per_signing":
        ore = i.ore * v.signings;
        break;
      case "share_of_gross":
        ore = Math.round(v.grossOre * i.rate);
        break;
    }
    return { key: i.key, label: i.label, source: i.source, ore };
  });
  return { totalOre: lines.reduce((a, l) => a + l.ore, 0), lines };
}

/**
 * Månadsvolym (kreatörernas andel, öre) där egen regi och SAMekonomi kostar
 * lika. Under den är SAMekonomi billigare.
 *
 * Förenkling: kostnaden räknas på ett typpass. Bruttolönen är ~76 % av
 * andelen vid full avgift (1 / 1,3142), och varje pass blir en utbetalning.
 */
export function breakEvenMonthlyBudgetOre(
  items: readonly CostItem[],
  opts: { samFeeRate: number; budgetPerPassOre: number; passesPerEmployee: number },
): number {
  const perBudgetOre = (budgetOre: number) => {
    const passes = budgetOre / opts.budgetPerPassOre;
    return monthlyCost(items, {
      grossOre: Math.round(budgetOre / 1.3142),
      employees: Math.ceil(passes / opts.passesPerEmployee),
      payouts: Math.ceil(passes),
      signings: 0,
    }).totalOre;
  };
  // Egen regis kostnad växer långsammare än SAM-avgiften; leta upp skärningen.
  let lo = 0;
  let hi = 100_000_000_00;
  if (perBudgetOre(hi) > hi * opts.samFeeRate) return Infinity;
  while (hi - lo > 100_00) {
    const mid = Math.floor((lo + hi) / 2);
    if (perBudgetOre(mid) > mid * opts.samFeeRate) lo = mid;
    else hi = mid;
  }
  return hi;
}
