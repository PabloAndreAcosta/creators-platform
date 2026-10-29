/**
 * Lön för betalda pass.
 *
 * Arrangören sätter vad passet får kosta per person (pay_ore). För den utan
 * bolag är det lönebudgeten — lön, semesterersättning och arbetsgivaravgift
 * ryms i den — och raden går till löneunderlaget när passet är incheckat.
 * Ingen moms och ingen provision: det är ingen försäljning utan arrangörens
 * egen kostnad. Den med bolag fakturerar beloppet själv.
 *
 * Rena funktioner; samma lönemotor som uppdragen.
 */

import { wageFromLabourBudget } from "@/lib/payroll/wage";
import { projectedRateInput } from "@/lib/payroll/rates";
import { SAMEKONOMI_FEE_RATE } from "@/lib/payroll/shadow";
import { ASSUMED_BIRTH_YEAR } from "@/lib/assignments/quote";
import { stockholmToday } from "@/lib/time";

function nextDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Vad kreatören utan bolag får i handen, ungefär, för ett betalt pass. */
export function shiftNetOre(payOre: number, passDate: string, birthYear?: number | null): number {
  const rated = projectedRateInput(nextDay(passDate), birthYear ?? ASSUMED_BIRTH_YEAR);
  return wageFromLabourBudget({ labourBudgetOre: payOre, birthYear: rated.birthYear, paidOn: rated.paidOn }).netOre;
}

export function buildShiftPayrollLine(input: {
  signupId: string;
  creatorId: string;
  startsAt: string;
  payOre: number;
  birthYear?: number | null;
}) {
  const passDate = stockholmToday(new Date(input.startsAt));
  const paidOn = nextDay(passDate);
  const rated = projectedRateInput(paidOn, input.birthYear ?? ASSUMED_BIRTH_YEAR);
  const w = wageFromLabourBudget({ labourBudgetOre: input.payOre, birthYear: rated.birthYear, paidOn: rated.paidOn });
  const samFeeOre = Math.round(w.labourBudgetOre * SAMEKONOMI_FEE_RATE);
  const sam = wageFromLabourBudget({ labourBudgetOre: w.labourBudgetOre - samFeeOre, birthYear: rated.birthYear, paidOn: rated.paidOn });
  return {
    shift_signup_id: input.signupId,
    creator_id: input.creatorId,
    pass_date: passDate,
    paid_on: paidOn,
    price_ore: input.payOre,
    vat_ore: 0,
    commission_ore: 0,
    labour_budget_ore: w.labourBudgetOre,
    gross_ore: w.grossOre,
    holiday_pay_ore: w.holidayPayOre,
    employer_fee_ore: w.employerFeeOre,
    fee_basis: w.feeBasis,
    withholding_ore: w.withholdingOre,
    net_ore: w.netOre,
    rounding_rest_ore: w.roundingRestOre,
    sam_fee_ore: samFeeOre,
    sam_net_ore: sam.netOre,
    estimated: input.birthYear == null || rated.projected,
  };
}
