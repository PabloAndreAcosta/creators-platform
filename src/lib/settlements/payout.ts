/**
 * Utbetalning av partnerns andel efter att kvällen ägt rum.
 *
 * Överföringen görs som en fristående Stripe-transfer och inte som en delning
 * vid köptillfället. Två skäl: Usha är säljare mot biljettköparen, så hela
 * intäkten är Ushas omsättning och partnerns andel en kostnad — och underlaget
 * är inte känt förrän kvällen är över och återbetalningarna landat.
 *
 * Filen är delad i två. Besluten — är kvällen klar, får partnern ta emot, hur
 * mycket — är rena funktioner som testas utan Stripe och utan databas. Bara
 * runSettlementPayouts rör omvärlden.
 */

import { splitEventRevenue, type Split } from "./split";
import { aggregateEventBookings, type SettlementBookingRow } from "./aggregate";

/**
 * Överföringar är AVSTÄNGDA om inte flaggan uttryckligen står på. Utan den kör
 * jobbet ändå, räknar ut allt och skriver en rad med status "dry_run" — men
 * flyttar inga pengar.
 *
 * Ordningen är medveten: den som slår på riktiga överföringar ska ha sett
 * torrkörningen först och kunnat jämföra beloppen mot Stripe innan en enda
 * krona rör sig automatiskt.
 */
export function payoutsEnabled(): boolean {
  return process.env.SETTLEMENT_PAYOUTS_ENABLED === "true";
}

/** Dagens datum i Stockholm som "YYYY-MM-DD". Evenemangsdatum är lokala datum. */
export function stockholmToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * Är kvällen klar att betalas ut?
 *
 * Jämförelsen görs på hela datum och inte på klockslag. Ett evenemang som
 * slutar 23.00 och ett som slutar 01.00 ska behandlas lika, och ingen ska
 * behöva resonera om sommartid för att förstå när pengarna går. Med
 * delayDays = 1 sker utbetalningen dagen efter evenemanget.
 */
export function isPayoutDue(eventDate: string, delayDays: number, today: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return false;
  const due = new Date(`${eventDate}T00:00:00Z`);
  due.setUTCDate(due.getUTCDate() + delayDays);
  return due.toISOString().slice(0, 10) <= today;
}

export interface PartnerPayoutProfile {
  id: string;
  stripe_account_id: string | null;
  company_verified_at: string | null;
  stripe_charges_enabled: boolean | null;
}

/**
 * Får partnern ta emot pengar?
 *
 * Returnerar skälet att INTE betala ut, eller null om allt är i ordning. Ett
 * skäl i klartext i stället för en boolean, eftersom det är det som ska hamna i
 * loggen och i felkolumnen — "hoppades över" utan orsak är obrukbart när någon
 * undrar var pengarna tog vägen.
 */
export function payoutBlockedReason(partner: PartnerPayoutProfile | null | undefined): string | null {
  if (!partner) return "partner saknas";
  if (!partner.company_verified_at) return "partnerns bolag är inte verifierat";
  if (!partner.stripe_account_id) return "partnern har inget anslutet Stripe-konto";
  if (!partner.stripe_charges_enabled) return "partnerns Stripe-konto kan inte ta emot ännu";
  return null;
}

export interface PayoutCandidate {
  listingId: string;
  listingTitle: string;
  eventDate: string;
  partner: PartnerPayoutProfile;
  partnerPercent: number;
  vatRate: number;
  payoutDelayDays: number;
  bookings: readonly SettlementBookingRow[];
}

export interface PayoutDecision {
  listingId: string;
  split: Split;
  /** Skäl att inte föra över. null = betala ut. */
  blocked: string | null;
}

/**
 * Avgör vad som ska hända med en kandidat. Ren funktion — hela beslutet om att
 * flytta pengar går att testa utan att något kan flyttas.
 */
export function decidePayout(c: PayoutCandidate): PayoutDecision {
  // commissionRate spelar ingen roll här: delningen räknas före Usha-avgiften,
  // så platform_fee påverkar inte partnerns andel. Noll gör det uttryckligt.
  const totals = aggregateEventBookings(c.bookings, 0);
  const split = splitEventRevenue({
    grossOre: totals.grossOre,
    refundedOre: totals.refundedOre,
    vatRate: c.vatRate,
    partnerPercent: c.partnerPercent,
  });

  let blocked = payoutBlockedReason(c.partner);

  // Noll kronor är inget fel, men det finns inget att föra över. En kväll som
  // ställdes in och återbetalades i sin helhet hamnar här.
  if (!blocked && split.partnerOre <= 0) blocked = "inget att betala ut";

  return { listingId: c.listingId, split, blocked };
}
