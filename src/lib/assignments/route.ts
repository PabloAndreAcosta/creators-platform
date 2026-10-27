/**
 * Uppdrag: vem betalar kreatören, och hur?
 *
 * Ett uppdrag är när någon annan än kreatören själv — en lokal, ett företag,
 * en förening — bokar kreatören för ett pass. Beställaren är då nästan alltid
 * ett företag, och ett företag som betalar en privatperson utan F-skatt för
 * arbete är ARBETSGIVARE redan från 1 000 kr per år: skatteavdrag,
 * arbetsgivaravgift och AGI. Det vet ingen lokal om när den swishar en
 * taxidansare.
 *
 * Därför får ett uppdrag aldrig betalas direkt till en kreatör utan bolag. Det
 * finns tre vägar och den här filen väljer:
 *
 *   own_company — kreatören har ett verifierat bolag och fakturerar själv.
 *                 Pengarna går som i dag via Stripe Connect.
 *   payroll     — kreatören har inget bolag. Usha säljer uppdraget i eget
 *                 namn och anställer kreatören för passet (egenanställning).
 *                 Beställaren blir aldrig arbetsgivare.
 *   usha        — Ushas eget konto. Ingen lön, ingen mellanhand.
 *
 * Valet görs på det som är VERIFIERAT, inte på vad någon kryssat i. Ett
 * overifierat bolag behandlas som inget bolag: att råka anställa någon som
 * hade F-skatt kostar en onödig arbetsgivaravgift, men att betala någon utan
 * F-skatt direkt gör beställaren till arbetsgivare utan att veta om det.
 */

export type AssignmentRoute = "own_company" | "payroll" | "usha";

export interface RouteInput {
  is_company: boolean | null;
  company_verified_at: string | null;
  is_usha_owned_seller?: boolean | null;
}

export function assignmentRoute(creator: RouteInput): AssignmentRoute {
  if (creator.is_usha_owned_seller) return "usha";
  if (creator.is_company && creator.company_verified_at) return "own_company";
  return "payroll";
}

/**
 * Lönevägen är byggd men inte i drift: lönekörning, AGI och utbetalning finns
 * bara i skuggläge (src/lib/payroll). Tills dess bokas uppdraget men betalas
 * inte i appen. Flaggan är en egen variabel och inte NEXT_PUBLIC_PAYMENTS_OPEN —
 * att öppna betalningar för privatpersoner får aldrig råka öppna lönevägen.
 */
export function payrollRouteLive(): boolean {
  return process.env.ASSIGNMENT_PAYROLL_LIVE === "true";
}

export const ASSIGNMENT_PAYROLL_NOT_LIVE_MESSAGE =
  "Uppdraget är bokat. Kreatören anställs via Usha för passet, och den betalningen öppnar när Ushas lönehantering är i drift. Betala inte kreatören direkt — då blir ni arbetsgivare.";
