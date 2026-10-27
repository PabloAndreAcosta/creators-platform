import { createAdminClient } from "@/lib/supabase/admin";
import { getCreatorCommissionRate } from "@/lib/stripe/commission";
import { assignmentRoute } from "./route";
import { buildShadowLine } from "./shadow-line";

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
    .select("id, creator_id, scheduled_at, agreed_price, status, listing:listings(listing_type, price)")
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

  const priceKr = booking.agreed_price ?? listing.price ?? 0;
  const row = buildShadowLine({
    bookingId: booking.id,
    creatorId: booking.creator_id,
    scheduledAt: booking.scheduled_at,
    priceKr,
    commissionRate: getCreatorCommissionRate(creator.tier ?? "gratis", creator.creator_subcategory),
  });

  const { error } = await db.from("payroll_shadow_lines").upsert(row, { onConflict: "booking_id" });
  if (error) throw error;
  return "written";
}
