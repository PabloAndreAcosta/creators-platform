"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/create";
import { passBookingFields } from "@/lib/passes/series-pass";

/**
 * Bekräftelse av klippkort betalda via Epassi.
 *
 * Bara kortets ägare (creator_id) eller en admin får bekräfta. Det är en
 * pengahandling — den sätter amount_paid som avräkningen räknar på — så den
 * följer samma regel som kassan: medarrangörer får inte.
 */

type Booking = {
  id: string;
  creator_id: string;
  customer_id: string;
  listing_id: string;
  status: string;
  payment_method: string | null;
  sessions_total: number | null;
};

async function loadForOwner(bookingId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "login_required" as const };
  const admin = createAdminClient();

  const { data: booking } = await admin
    .from("bookings")
    .select("id, creator_id, customer_id, listing_id, status, payment_method, sessions_total")
    .eq("id", bookingId)
    .maybeSingle<Booking>();
  if (!booking || booking.payment_method !== "epassi") return { error: "not_found" as const };

  if (booking.creator_id !== user.id) {
    const { data: prof } = await admin.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
    if (!prof?.is_admin) return { error: "forbidden" as const };
  }
  return { admin, booking };
}

export async function confirmEpassiPass(formData: FormData): Promise<void> {
  const bookingId = String(formData.get("bookingId") ?? "");
  const res = await loadForOwner(bookingId);
  if ("error" in res) return;
  const { admin, booking } = res;
  if (booking.status !== "pending") return;

  const { data: listing } = await admin
    .from("listings")
    .select("title, price")
    .eq("id", booking.listing_id)
    .maybeSingle();
  if (!listing || !(listing.price > 0)) return;

  const now = new Date();
  // Giltighetstiden räknas från bekräftelsen — det är då kortet blir
  // användbart — inte från när kunden tryckte på knappen.
  const pass = passBookingFields(booking.sessions_total, now);

  const { data: updated } = await admin
    .from("bookings")
    .update({
      status: "confirmed",
      amount_paid: Math.round(listing.price * 100),
      platform_fee_amount: 0,
      scheduled_at: now.toISOString(),
      ...("pass_expires_at" in pass ? { pass_expires_at: pass.pass_expires_at } : {}),
      updated_at: now.toISOString(),
    })
    .eq("id", booking.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (!updated) return;

  await createNotification({
    userId: booking.customer_id,
    type: "booking_confirmed",
    titleKey: "epassiConfirmedTitle",
    bodyKey: "epassiConfirmedMsg",
    params: { service: listing.title },
    link: `/biljett/${booking.id}`,
  });

  revalidatePath("/app/epassi");
}

export async function rejectEpassiPass(formData: FormData): Promise<void> {
  const bookingId = String(formData.get("bookingId") ?? "");
  const res = await loadForOwner(bookingId);
  if ("error" in res) return;
  const { admin, booking } = res;
  if (booking.status !== "pending") return;

  const { data: listing } = await admin
    .from("listings")
    .select("title")
    .eq("id", booking.listing_id)
    .maybeSingle();

  const { data: updated } = await admin
    .from("bookings")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("id", booking.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (!updated) return;

  await createNotification({
    userId: booking.customer_id,
    type: "booking_canceled",
    titleKey: "epassiRejectedTitle",
    bodyKey: "epassiRejectedMsg",
    params: { service: listing?.title ?? { key: "fallbackService" } },
    link: "/app/tickets",
  });

  revalidatePath("/app/epassi");
}
