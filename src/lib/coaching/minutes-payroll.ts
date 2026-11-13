import { createAdminClient } from "@/lib/supabase/admin";
import { effectiveCommissionRate } from "@/lib/stripe/commission";
import { assignmentRoute, payrollRouteLive } from "@/lib/assignments/route";
import { buildShadowLine } from "@/lib/assignments/shadow-line";

/**
 * Instruktörsminuter på lönevägen.
 *
 * En instruktör utan verifierat bolag kan inte få betalt direkt: köparen (och
 * Usha) blir då arbetsgivare utan att veta om det. Minuterna säljs i stället av
 * Usha i eget namn, och instruktören får lön via SAMekonomi för det hen faktiskt
 * undervisat. Samma väg, flagga och pilotlista som uppdragen
 * (lib/assignments/route.ts).
 *
 * Lönen räknas på INLÖSTA minuter, inte köpta: köparen kan ha minuter kvar
 * när kvällen är slut, och det arbetet är inte utfört. Varje inlösen räknar
 * om bokningens rad i payroll_shadow_lines (unik per bokning) tills underlaget
 * skickats; därefter rörs den aldrig.
 */

/** Den del av betalningen som motsvarar inlösta minuter, i hela kronor. */
export function redeemedPriceKr(paidOre: number, minutesTotal: number, minutesRedeemed: number): number {
  if (paidOre <= 0 || minutesTotal <= 0 || minutesRedeemed <= 0) return 0;
  const share = Math.min(minutesRedeemed, minutesTotal) / minutesTotal;
  return Math.round((paidOre * share) / 100);
}

export const MINUTES_PAYROLL_NOT_LIVE_MESSAGE =
  "Instruktören har inget eget företag och får lön via Usha för sina lektioner. Den betalningen öppnar när Ushas lönehantering är i drift.";

/**
 * Skriver eller räknar om löneraden för en minutbokning efter en inlösen.
 * Gör ingenting för instruktörer med bolag eller för bokningar som inte gick
 * på lönevägen. Fel loggas av anroparen — en lönerad får aldrig stoppa en
 * inlösen på plats.
 */
export async function recordMinutesShadowLine(bookingId: string): Promise<"written" | "skipped"> {
  const db = createAdminClient();
  const { data: booking } = await db
    .from("bookings")
    .select("id, creator_id, customer_id, booking_type, stripe_payment_id, amount_paid, minutes_total, minutes_redeemed, listing:listings(event_date)")
    .eq("id", bookingId)
    .single();
  if (!booking || booking.booking_type !== "instructor_minutes") return "skipped";

  const { data: instructor } = await db
    .from("profiles")
    .select("tier, creator_subcategory, is_company, company_verified_at, is_usha_owned_seller")
    .eq("id", booking.creator_id)
    .single();
  if (!instructor) return "skipped";
  const route = assignmentRoute({
    is_company: instructor.is_company ?? null,
    company_verified_at: instructor.company_verified_at ?? null,
    is_usha_owned_seller: instructor.is_usha_owned_seller ?? null,
  });
  if (route !== "payroll") return "skipped";

  const { data: existing } = await db
    .from("payroll_shadow_lines")
    .select("sam_submitted_at")
    .eq("booking_id", booking.id)
    .maybeSingle();
  if (existing?.sam_submitted_at) return "skipped";

  const priceKr = redeemedPriceKr(booking.amount_paid ?? 0, booking.minutes_total ?? 0, booking.minutes_redeemed ?? 0);
  if (priceKr <= 0) return "skipped";

  const listing = Array.isArray(booking.listing) ? booking.listing[0] : booking.listing;
  const live =
    payrollRouteLive({ customerId: booking.customer_id, creatorId: booking.creator_id }) && !!booking.stripe_payment_id;
  const row = buildShadowLine({
    bookingId: booking.id,
    creatorId: booking.creator_id,
    // Kvällen lektionen hölls, i Stockholmstid (12:00 håller datumet stilla).
    scheduledAt: listing?.event_date ? `${listing.event_date}T12:00:00Z` : new Date().toISOString(),
    priceKr,
    commissionRate: effectiveCommissionRate(Math.round(priceKr * 100)),
  });

  const { error } = await db.from("payroll_shadow_lines").upsert({ ...row, live }, { onConflict: "booking_id" });
  if (error) throw error;
  return "written";
}
