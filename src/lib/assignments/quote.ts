/**
 * Vad ett uppdrag ger, räknat innan någon tackar ja.
 *
 * Ingen ska välja ett uppdrag vars utfall de inte ser. Kreatören ska se vad
 * som hamnar på kontot, beställaren vad de betalar och att de inte blir
 * arbetsgivare. Båda siffrorna kommer härifrån, så att det kreatören lovas och
 * det som sedan räknas i lönen inte kan glida isär.
 *
 * Priset är det beställaren betalar totalt, i hela kronor — samma tal som
 * booking-pay tar betalt för i dag.
 *
 *   own_company — Usha tar provision, resten går till kreatörens bolag, som
 *                 själv redovisar moms och skatt på sitt belopp.
 *   payroll     — Usha säljer uppdraget och redovisar momsen. Kvar efter moms
 *                 och provision är lönebudgeten: lön + semesterersättning +
 *                 arbetsgivaravgift. Skatteavdraget dras från lönen.
 *
 * Alla belopp i ÖRE.
 */

import { wageFromLabourBudget, type Wage } from "@/lib/payroll/wage";
import { RATES_BY_YEAR } from "@/lib/payroll/rates";
import type { AssignmentRoute } from "./route";

/** Moms på uppdrag som Usha säljer i eget namn. Undervisning, DJ, uppträdande. */
export const ASSIGNMENT_VAT_RATE = 0.25;

/**
 * Födelseår när vi inte vet något. Ger full arbetsgivaravgift — den lägsta
 * nettolönen för alla under 67 — så att uppskattningen aldrig lovar för mycket.
 */
const ASSUMED_BIRTH_YEAR = 1990;

export interface QuoteInput {
  priceKr: number;
  route: AssignmentRoute;
  commissionRate: number;
  /** Utbetalningsdag, ISO. Styr avgiftssatserna. */
  paidOn: string;
  birthYear?: number | null;
  vatRate?: number;
}

export type AssignmentQuote =
  | {
      route: "own_company" | "usha";
      priceOre: number;
      commissionOre: number;
      /** Det som förs över till kreatörens bolag. */
      toCreatorOre: number;
    }
  | {
      route: "payroll";
      priceOre: number;
      vatOre: number;
      commissionOre: number;
      wage: Wage;
      /** Födelseåret var okänt eller årets satser saknas; nettot är en uppskattning. */
      estimated: boolean;
    };

export function quoteAssignment(input: QuoteInput): AssignmentQuote {
  const { priceKr, route, commissionRate, paidOn } = input;
  if (!Number.isFinite(priceKr) || priceKr < 0) throw new Error("priceKr måste vara ≥ 0");
  if (commissionRate < 0 || commissionRate >= 1) throw new Error("commissionRate anges som decimal");
  const priceOre = Math.round(priceKr * 100);

  if (route !== "payroll") {
    // Samma avrundning som booking-pay använder för application_fee.
    const commissionOre = Math.round(priceOre * commissionRate);
    return { route, priceOre, commissionOre, toCreatorOre: priceOre - commissionOre };
  }

  const vatRate = input.vatRate ?? ASSIGNMENT_VAT_RATE;
  // Priset innehåller momsen, precis som en biljett.
  const vatOre = Math.round(priceOre * (vatRate / (1 + vatRate)));
  const exVatOre = priceOre - vatOre;
  const commissionOre = Math.round(exVatOre * commissionRate);

  // Ett gig långt fram kan ligga i ett år vars satser ännu inte finns. En
  // offert är en uppskattning, så den räknas då med senast kända års satser —
  // lönekörningen gör aldrig så, den stannar.
  const year = Number(paidOn.slice(0, 4));
  const latest = Math.max(...Object.keys(RATES_BY_YEAR).map(Number));
  const shift = year in RATES_BY_YEAR ? 0 : year - latest;
  const birthYear = input.birthYear ?? ASSUMED_BIRTH_YEAR;

  const wage = wageFromLabourBudget({
    labourBudgetOre: exVatOre - commissionOre,
    birthYear: birthYear - shift,
    paidOn: shift === 0 ? paidOn : `${latest}${paidOn.slice(4)}`,
  });
  return {
    route,
    priceOre,
    vatOre,
    commissionOre,
    wage,
    estimated: input.birthYear == null || shift !== 0,
  };
}

/** Det kreatören får in på kontot, oavsett väg. */
export function creatorReceivesOre(q: AssignmentQuote): number {
  return q.route === "payroll" ? q.wage.netOre : q.toCreatorOre;
}
