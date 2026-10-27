/**
 * Skuggrad för ett slutfört uppdrag: vad lönen HADE blivit.
 *
 * När ett uppdrag på lönevägen markeras som genomfört skrivs en rad till
 * payroll_shadow_lines — i egen regi och via SAMekonomi, sida vid sida. Inga
 * pengar rör sig. Raderna låter skuggkörningen räkna på riktiga uppdrag i
 * stället för antaganden, och blir facit att jämföra mot när lönen går skarpt.
 *
 * Ren funktion. Inläsning och skrivning sker i record-shadow.ts.
 */

import { quoteAssignment, ASSUMED_BIRTH_YEAR } from "./quote";
import { wageFromLabourBudget } from "@/lib/payroll/wage";
import { projectedRateInput } from "@/lib/payroll/rates";
import { SAMEKONOMI_FEE_RATE } from "@/lib/payroll/shadow";
import { stockholmToday } from "@/lib/time";

export interface ShadowLineInput {
  bookingId: string;
  creatorId: string;
  /** bookings.scheduled_at, UTC. */
  scheduledAt: string;
  /** Det beställaren betalar totalt, hela kronor. */
  priceKr: number;
  commissionRate: number;
  birthYear?: number | null;
}

export interface ShadowLineRow {
  booking_id: string;
  creator_id: string;
  pass_date: string;
  paid_on: string;
  price_ore: number;
  vat_ore: number;
  commission_ore: number;
  labour_budget_ore: number;
  gross_ore: number;
  holiday_pay_ore: number;
  employer_fee_ore: number;
  fee_basis: "full" | "senior" | "none" | "youth";
  withholding_ore: number;
  net_ore: number;
  rounding_rest_ore: number;
  sam_fee_ore: number;
  sam_net_ore: number;
  estimated: boolean;
}

function nextDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function buildShadowLine(input: ShadowLineInput): ShadowLineRow {
  // Passets dag i Stockholm, inte i serverns UTC: ett kvällspass efter
  // midnatt UTC hör till dagen innan.
  const passDate = stockholmToday(new Date(input.scheduledAt));
  // Lönen betalas dagen efter passet, som avräkningen gör för partners.
  const paidOn = nextDay(passDate);

  const q = quoteAssignment({
    priceKr: input.priceKr,
    route: "payroll",
    commissionRate: input.commissionRate,
    paidOn,
    birthYear: input.birthYear,
  });
  if (q.route !== "payroll") throw new Error("lönevägen förväntades");
  const w = q.wage;

  // SAMekonomi tar sina 2 % av samma lönebudget och räknar lön på resten.
  const samFeeOre = Math.round(w.labourBudgetOre * SAMEKONOMI_FEE_RATE);
  // Samma satsår och födelseår som offerten använde, så att jämförelsen inte haltar.
  const rated = projectedRateInput(paidOn, input.birthYear ?? ASSUMED_BIRTH_YEAR);
  const sam = wageFromLabourBudget({
    labourBudgetOre: w.labourBudgetOre - samFeeOre,
    birthYear: rated.birthYear,
    paidOn: rated.paidOn,
  });

  return {
    booking_id: input.bookingId,
    creator_id: input.creatorId,
    pass_date: passDate,
    paid_on: paidOn,
    price_ore: q.priceOre,
    vat_ore: q.vatOre,
    commission_ore: q.commissionOre,
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
    estimated: q.estimated,
  };
}
