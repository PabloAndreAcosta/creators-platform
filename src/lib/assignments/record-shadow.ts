import { createAdminClient } from "@/lib/supabase/admin";
import { getCreatorCommissionRate } from "@/lib/stripe/commission";
import { assignmentRoute, payrollRouteLive } from "./route";
import { buildShadowLine } from "./shadow-line";
import { refundDebtOre } from "./underlag";

/**
 * Skriver skuggraden för ett slutfört uppdrag, om det gick på lönevägen.
 *
 * Anropas när en bokning blir completed. Gör ingenting för andra bokningar
 * (biljetter, tjänster, kreatörer med bolag). Upsert på booking_id gör att ett
 * upprepat anrop inte dubblerar raden. Fel loggas av anroparen — en skuggrad
 * får aldrig stoppa att ett uppdrag markeras genomfört.
 */
export async function recordAssignmentShadowLine(bookingId: string): Promise<"written" | "skipped"> {
  const db = createAdminClient();
  const { data: booking } = await db
    .from("bookings")
    .select("id, creator_id, customer_id, scheduled_at, agreed_price, status, stripe_payment_id, amount_paid, listing:listings(listing_type, price)")
    .eq("id", bookingId)
    .single();
  if (!booking || booking.status !== "completed") return "skipped";

  const listing = Array.isArray(booking.listing) ? booking.listing[0] : booking.listing;
  if (listing?.listing_type !== "b2b_offering") return "skipped";

  const { data: creator } = await db
    .from("profiles")
    .select("tier, creator_subcategory, is_company, company_verified_at, is_usha_owned_seller")
    .eq("id", booking.creator_id)
    .single();
  if (!creator) return "skipped";
  const route = assignmentRoute({
    is_company: creator.is_company ?? null,
    company_verified_at: creator.company_verified_at ?? null,
    is_usha_owned_seller: creator.is_usha_owned_seller ?? null,
  });
  if (route !== "payroll") return "skipped";

  // En rad som redan skickats till SAMekonomi är fakturerad och får aldrig
  // räknas om, hur många gånger anropet än upprepas.
  const { data: existing } = await db
    .from("payroll_shadow_lines")
    .select("sam_submitted_at")
    .eq("booking_id", booking.id)
    .maybeSingle();
  if (existing?.sam_submitted_at) return "skipped";

  // Betalades uppdraget till Usha är raden ett riktigt underlag, räknat på det
  // som faktiskt betalades. Annars är den ren skuggräkning på avtalat pris.
  const paidOre = booking.amount_paid ?? 0;
  const live =
    payrollRouteLive({ customerId: booking.customer_id, creatorId: booking.creator_id }) &&
    !!booking.stripe_payment_id &&
    paidOre > 0;
  const priceKr = live ? paidOre / 100 : (booking.agreed_price ?? listing.price ?? 0);
  const row = buildShadowLine({
    bookingId: booking.id,
    creatorId: booking.creator_id,
    scheduledAt: booking.scheduled_at,
    priceKr,
    commissionRate: getCreatorCommissionRate(creator.tier ?? "gratis", creator.creator_subcategory),
  });

  const { error } = await db.from("payroll_shadow_lines").upsert({ ...row, live }, { onConflict: "booking_id" });
  if (error) throw error;
  return "written";
}

/**
 * Ett uppdrag på lönevägen har återbetalats.
 *
 * Har underlaget inte skickats än stryks raden — den ska inte faktureras. Har
 * det skickats är lönen betald och går inte att backa (SAMekonomi kan inte
 * återkalla skatt och avgifter), så återbetalningen blir en skuld som dras från
 * kreatörens nästa underlag. Unikt index på booking_id i creator_debts gör att
 * Stripes omleveranser inte bokför skulden två gånger.
 */
export async function recordAssignmentRefund(bookingId: string, refundedOre: number): Promise<"voided" | "debt" | "skipped"> {
  const db = createAdminClient();
  const { data: line } = await db
    .from("payroll_shadow_lines")
    .select("id, creator_id, price_ore, labour_budget_ore, sam_submitted_at, voided_at")
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (!line || line.voided_at) return "skipped";

  if (!line.sam_submitted_at) {
    await db.from("payroll_shadow_lines").update({ voided_at: new Date().toISOString() }).eq("id", line.id);
    return "voided";
  }

  const amount = refundDebtOre(line, refundedOre);
  if (amount <= 0) return "skipped";
  const { error } = await db.from("creator_debts").insert({
    partner_profile_id: line.creator_id,
    booking_id: bookingId,
    amount_ore: amount,
    reason: "refund_after_payout",
    note: `Uppdrag återbetalat efter inskickat löneunderlag (${refundedOre} öre återbetalt)`,
  });
  if (error && error.code !== "23505") throw error;
  return "debt";
}
