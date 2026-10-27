/**
 * Från kreatörens andel till lön.
 *
 * Avräkningen (src/lib/settlements) säger hur mycket av en kväll som är
 * kreatörens. När kreatören är ANSTÄLLD hos Usha är den andelen inte en
 * utbetalning utan en lönekostnad: lön + semesterersättning +
 * arbetsgivaravgift ska tillsammans rymmas i andelen. Det är samma räkning
 * som SAMekonomi gör åt oss i dag (450 kr → ca 235 kr netto), minus deras 2 %.
 *
 * Ordningen är:
 *   andel = (lön + semesterersättning) + arbetsgivaravgift
 *   semesterersättning = 12 % av lönen (semesterlagen 16 b §)
 *   skatteavdrag dras från (lön + semesterersättning), inte från andelen
 *
 * Alla belopp i ÖRE. Ingenting här rör pengar eller databas — run-filen gör
 * det. Den här filen måste gå att testa uttömmande.
 */

import { employerFee, type Fee } from "./rates";

/** Semesterersättning enligt procentregeln, för korta anställningar. */
export const HOLIDAY_PAY_RATE = 0.12;

/**
 * Skatteavdrag när arbetet varar kortare än en vecka eller inte är
 * huvudinkomst. Ett jämkningsbeslut går före.
 */
export const DEFAULT_WITHHOLDING_RATE = 0.3;

export interface WageInput {
  /** Det som får kosta: kreatörens andel efter Ushas provision. */
  labourBudgetOre: number;
  birthYear: number;
  paidOn: string;
  monthToDateGrossOre?: number;
  /**
   * Skatteavdrag som decimal. Utelämnat = 30 %. Tabellskatt räknas utanför
   * och skickas in som ett färdigt belopp via withholdingOre i stället.
   */
  withholdingRate?: number;
  /** Färdigt skatteavdrag i öre (t.ex. från Skatteverkets API). Går före rate. */
  withholdingOre?: number;
}

export interface Wage {
  labourBudgetOre: number;
  /** Lön före semesterersättning. */
  wageOre: number;
  holidayPayOre: number;
  /** Lön + semesterersättning: det som står som bruttolön i AGI. */
  grossOre: number;
  employerFeeOre: number;
  feeBasis: Fee["basis"];
  withholdingOre: number;
  /** Det som betalas till kreatörens konto. */
  netOre: number;
  /** Öre som inte gick att fördela p.g.a. avrundning. Stannar hos Usha. */
  roundingRestOre: number;
}

/**
 * Räknar baklänges från en budget till lön.
 *
 * Avrundning: bruttolönen avrundas NEDÅT till hela kronor. Då kan
 * arbetsgivaravgiften aldrig göra att totalen spräcker budgeten, och
 * lönebeskedet visar jämna kronor. Resten redovisas öppet i roundingRestOre
 * i stället för att försvinna.
 */
export function wageFromLabourBudget(input: WageInput): Wage {
  const { labourBudgetOre, birthYear, paidOn } = input;
  if (!Number.isInteger(labourBudgetOre) || labourBudgetOre < 0) {
    throw new Error("labourBudgetOre måste vara ett heltal ≥ 0 (öre)");
  }

  // Första gissning med full avgiftssats, sedan ned krona för krona tills
  // lön + avgift ryms. Avgiften är inte alltid linjär (ungdomstaket), så en
  // sluten formel räcker inte; loopen kör högst några varv.
  const probe = employerFee({ birthYear, paidOn, grossOre: 100_000_00 });
  const approxRate = probe.feeOre / 100_000_00;
  let grossOre = Math.floor(labourBudgetOre / (1 + approxRate) / 100) * 100;
  let fee = employerFee({
    birthYear,
    paidOn,
    grossOre,
    monthToDateGrossOre: input.monthToDateGrossOre,
  });
  while (grossOre > 0 && grossOre + fee.feeOre > labourBudgetOre) {
    grossOre -= 100;
    fee = employerFee({
      birthYear,
      paidOn,
      grossOre,
      monthToDateGrossOre: input.monthToDateGrossOre,
    });
  }

  // Bruttolönen innehåller semesterersättningen: brutto = lön × 1,12.
  const wageOre = Math.round(grossOre / (1 + HOLIDAY_PAY_RATE));
  const holidayPayOre = grossOre - wageOre;

  let withholdingOre: number;
  if (input.withholdingOre !== undefined) {
    withholdingOre = input.withholdingOre;
  } else {
    const rate = input.withholdingRate ?? DEFAULT_WITHHOLDING_RATE;
    if (rate < 0 || rate >= 1) throw new Error("withholdingRate anges som decimal, t.ex. 0.3");
    // Skatteavdrag i hela kronor, avrundat nedåt.
    withholdingOre = Math.floor((grossOre * rate) / 100) * 100;
  }
  if (withholdingOre < 0 || withholdingOre > grossOre) {
    throw new Error("withholdingOre måste ligga mellan 0 och bruttolönen");
  }

  return {
    labourBudgetOre,
    wageOre,
    holidayPayOre,
    grossOre,
    employerFeeOre: fee.feeOre,
    feeBasis: fee.basis,
    withholdingOre,
    netOre: grossOre - withholdingOre,
    roundingRestOre: labourBudgetOre - grossOre - fee.feeOre,
  };
}
