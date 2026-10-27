/**
 * Skuggkörning: samma pass räknat på två sätt, sida vid sida.
 *
 * I dag går lönen genom SAMekonomi (FakturaLön). Innan Usha kan ta över
 * lönen själv måste vi veta att vår motor ger samma svar — eller kunna
 * förklara varje krona som skiljer. Skuggkörningen flyttar inga pengar och
 * skriver ingenting. Den tar ett antal pass och visar:
 *
 *   via SAMekonomi — budgeten minus deras 2 %, sedan lön som vanligt
 *   egen regi     — hela budgeten till lön, men Usha bär fasta kostnader
 *
 * och summerar per kalendermånad, eftersom det är så AGI, ungdomstaket och
 * a-kassans inkomstvillkor räknar.
 *
 * Alla belopp i ÖRE. Ren funktion — skriptet i scripts/ läser databasen.
 */

import { wageFromLabourBudget, type Wage } from "./wage";
import { RATES_BY_YEAR } from "./rates";
import { lasStatus, type LasStatus } from "./las";

/** SAMekonomis avgift: 2 % av fakturabeloppet exkl. moms. */
export const SAMEKONOMI_FEE_RATE = 0.02;

/**
 * A-kassans inkomstvillkor i lagen 2024:506: en månad räknas bara om
 * arbetsinkomsten når 11 000 kr. Visas för att kreatören ska se om
 * anställningen faktiskt kan ge a-kassa, inte bara att den är försäkrad.
 */
export const AKASSA_MONTH_THRESHOLD_ORE = 1_100_000;

export interface ShadowPass {
  /** Passets datum, ISO. Styr LAS-räkningen. */
  date: string;
  /** Det kreatören ska ha för passet, före lön: andelen exkl. moms. */
  labourBudgetOre: number;
  /**
   * Återbetalning som kommit EFTER att lönen för passet betalats. Den går
   * inte att backa i lönen; den blir en skuld som dras från nästa pass.
   */
  lateRefundOre?: number;
}

export interface ShadowCreator {
  birthYear: number;
  /** Utelämnat = 30 %. */
  withholdingRate?: number;
}

export interface ShadowOptions {
  /**
   * Räkna år som saknas i satstabellen med senast kända års satser. Bara för
   * scenarier som sträcker sig in i framtiden — lönekörningen har inget sådant
   * val och ska stanna. Rader som räknats så markeras `projected`.
   */
  projectMissingYears?: boolean;
}

export interface ShadowLine {
  date: string;
  paidOn: string;
  /** Räknad med ett annat års satser än utbetalningsårets. */
  projected: boolean;
  budgetOre: number;
  debtDeductedOre: number;
  samekonomi: Wage & { feeToSamOre: number };
  ownRegime: Wage;
}

export interface ShadowMonth {
  month: string;
  passes: number;
  budgetOre: number;
  samNetOre: number;
  ownNetOre: number;
  samGrossOre: number;
  ownGrossOre: number;
  ownEmployerFeeOre: number;
  ownWithholdingOre: number;
  samFeeOre: number;
  /** Det Usha ska betala till skattekontot senast den 12:e månaden efter. */
  ownTaxAccountOre: number;
  reachesAkassaMonth: boolean;
}

export interface ShadowResult {
  lines: ShadowLine[];
  months: ShadowMonth[];
  totals: {
    budgetOre: number;
    samNetOre: number;
    ownNetOre: number;
    samFeeOre: number;
    roundingRestOre: number;
    /** Skuld från sena återbetalningar som inte hunnit kvittas. */
    openDebtOre: number;
  };
  las: LasStatus;
}

/**
 * Lönen betalas ut dagen efter passet, som avräkningen redan gör för
 * partners. Utbetalningsdagen avgör satser och månad — inte passdagen.
 */
function nextDay(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

const LATEST_RATE_YEAR = Math.max(...Object.keys(RATES_BY_YEAR).map(Number));

export function shadowRun(
  creator: ShadowCreator,
  passes: readonly ShadowPass[],
  today: string,
  options: ShadowOptions = {},
): ShadowResult {
  const sorted = [...passes].sort((a, b) => a.date.localeCompare(b.date));
  const lines: ShadowLine[] = [];
  const monthGross = new Map<string, { sam: number; own: number }>();
  let debtOre = 0;
  let roundingRestOre = 0;

  for (const p of sorted) {
    const paidOn = nextDay(p.date);
    const month = paidOn.slice(0, 7);
    const projected = options.projectMissingYears === true && !(Number(paidOn.slice(0, 4)) in RATES_BY_YEAR);
    // Samma dag i senast kända år, så att datumgränser inom året fortfarande gäller.
    const rateDate = projected ? `${LATEST_RATE_YEAR}${paidOn.slice(4)}` : paidOn;
    const mtd = monthGross.get(month) ?? { sam: 0, own: 0 };

    // Kvitta skuld från tidigare sena återbetalningar innan lönen räknas.
    const debtDeductedOre = Math.min(debtOre, p.labourBudgetOre);
    debtOre -= debtDeductedOre;
    const budgetOre = p.labourBudgetOre - debtDeductedOre;

    const base = {
      // Åldern räknas mot satsåret, så födelseåret flyttas lika mycket.
      birthYear: creator.birthYear - (Number(paidOn.slice(0, 4)) - Number(rateDate.slice(0, 4))),
      paidOn: rateDate,
      withholdingRate: creator.withholdingRate,
    };
    // SAMekonomi tar sin avgift först; resten går till löneberäkning.
    const feeToSamOre = Math.round(budgetOre * SAMEKONOMI_FEE_RATE);
    const sam = wageFromLabourBudget({
      ...base,
      labourBudgetOre: budgetOre - feeToSamOre,
      monthToDateGrossOre: mtd.sam,
    });
    const own = wageFromLabourBudget({
      ...base,
      labourBudgetOre: budgetOre,
      monthToDateGrossOre: mtd.own,
    });

    monthGross.set(month, { sam: mtd.sam + sam.grossOre, own: mtd.own + own.grossOre });
    roundingRestOre += own.roundingRestOre;
    debtOre += p.lateRefundOre ?? 0;

    lines.push({
      date: p.date,
      paidOn,
      projected,
      budgetOre,
      debtDeductedOre,
      samekonomi: { ...sam, feeToSamOre },
      ownRegime: own,
    });
  }

  const byMonth = new Map<string, ShadowMonth>();
  for (const l of lines) {
    const month = l.paidOn.slice(0, 7);
    const m =
      byMonth.get(month) ??
      ({
        month,
        passes: 0,
        budgetOre: 0,
        samNetOre: 0,
        ownNetOre: 0,
        samGrossOre: 0,
        ownGrossOre: 0,
        ownEmployerFeeOre: 0,
        ownWithholdingOre: 0,
        samFeeOre: 0,
        ownTaxAccountOre: 0,
        reachesAkassaMonth: false,
      } satisfies ShadowMonth);
    m.passes += 1;
    m.budgetOre += l.budgetOre;
    m.samNetOre += l.samekonomi.netOre;
    m.ownNetOre += l.ownRegime.netOre;
    m.samGrossOre += l.samekonomi.grossOre;
    m.ownGrossOre += l.ownRegime.grossOre;
    m.ownEmployerFeeOre += l.ownRegime.employerFeeOre;
    m.ownWithholdingOre += l.ownRegime.withholdingOre;
    m.samFeeOre += l.samekonomi.feeToSamOre;
    m.ownTaxAccountOre = m.ownEmployerFeeOre + m.ownWithholdingOre;
    m.reachesAkassaMonth = m.ownGrossOre >= AKASSA_MONTH_THRESHOLD_ORE;
    byMonth.set(month, m);
  }
  const months = [...byMonth.values()];

  const sum = (f: (l: ShadowLine) => number) => lines.reduce((a, l) => a + f(l), 0);
  return {
    lines,
    months,
    totals: {
      budgetOre: sum((l) => l.budgetOre),
      samNetOre: sum((l) => l.samekonomi.netOre),
      ownNetOre: sum((l) => l.ownRegime.netOre),
      samFeeOre: sum((l) => l.samekonomi.feeToSamOre),
      roundingRestOre,
      openDebtOre: debtOre,
    },
    las: lasStatus(
      sorted.map((p) => p.date),
      today,
    ),
  };
}

/**
 * Hur mycket kreatörens andel per pass måste vara för att en månad med
 * `passesPerMonth` pass ska nå a-kassans 11 000 kr i bruttolön.
 */
export function budgetPerPassForAkassa(birthYear: number, paidOn: string, passesPerMonth: number): number {
  let lo = 0;
  let hi = 5_000_000;
  // Bruttolönen växer monotont med budgeten; binärsök i hela kronor.
  while (hi - lo > 100) {
    const mid = Math.floor((lo + hi) / 200) * 100;
    const gross = wageFromLabourBudget({ labourBudgetOre: mid, birthYear, paidOn }).grossOre;
    if (gross * passesPerMonth >= AKASSA_MONTH_THRESHOLD_ORE) hi = mid;
    else lo = mid;
  }
  return hi;
}
