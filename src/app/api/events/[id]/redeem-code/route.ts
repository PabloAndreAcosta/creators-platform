import { NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidEmail, normalizeEmail, cleanName } from "@/lib/waitlist";
import { sendBookingConfirmationEmail } from "@/lib/email/send-booking";
import { getStripeLocale } from "@/lib/i18n/stripe-locale";
import { stripe } from "@/lib/stripe/client";
import { getCreatorCommissionRate } from "@/lib/stripe/commission";
import { canReceivePayments, PAYMENTS_BETA_BLOCKED_MESSAGE } from "@/lib/payments/beta-gate";

// Redeem an event access code for a ticket. Works for logged-in users and guests
// (email required). Two kinds of code:
//   • discount_price = NULL → FREE ticket (team / VIP). Booked directly, atomic.
//   • discount_price set (kr) → PAID ticket at that price via Stripe. The use is
//     consumed in the webhook AFTER successful payment (never on an abandoned checkout).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: listingId } = await params;
  const te = await getTranslations("eventErrors");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let body: { code?: unknown; email?: unknown; name?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: te("generic") }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!code) return NextResponse.json({ error: te("codeRequired") }, { status: 400 });

  const email = user?.email ?? (isValidEmail(body.email) ? normalizeEmail(body.email) : null);
  if (!email) return NextResponse.json({ error: te("invalidEmail") }, { status: 400 });
  const name = cleanName(body.name);

  const admin = createAdminClient();
  const { data: listing } = await admin
    .from("listings")
    .select("id, user_id, title, event_date, event_time, capacity, tickets_sold")
    .eq("id", listingId)
    .eq("is_active", true)
    .maybeSingle();
  if (!listing) return NextResponse.json({ error: te("eventNotFound") }, { status: 404 });

  // Look up the code (validate-only) to decide free vs discount. Codes are stored
  // upper/trimmed, matching redeem_access_code's upper(btrim()).
  const { data: codeRow } = await admin
    .from("event_access_codes")
    .select("id, discount_price, is_active, max_uses, used_count")
    .eq("listing_id", listingId)
    .eq("code", code.toUpperCase())
    .maybeSingle();
  if (
    !codeRow ||
    !codeRow.is_active ||
    (codeRow.max_uses !== null && codeRow.used_count >= codeRow.max_uses)
  ) {
    return NextResponse.json({ error: te("invalidCode") }, { status: 400 });
  }

  // ── DISCOUNT CODE → paid ticket at discount_price via Stripe Connect ──
  if (codeRow.discount_price && codeRow.discount_price > 0) {
    if (listing.capacity !== null && (listing.tickets_sold ?? 0) >= listing.capacity) {
      return NextResponse.json({ error: te("soldOut") }, { status: 403 });
    }

    const { data: creator } = await admin
      .from("profiles")
      .select("stripe_account_id, tier, company_verified_at")
      .eq("id", listing.user_id)
      .maybeSingle();

    if (!creator?.stripe_account_id) {
      return NextResponse.json({ error: te("generic") }, { status: 400 });
    }
    if (!canReceivePayments({ id: listing.user_id, company_verified_at: creator.company_verified_at })) {
      return NextResponse.json({ error: PAYMENTS_BETA_BLOCKED_MESSAGE }, { status: 403 });
    }

    const amountInOre = Math.round(codeRow.discount_price * 100);
    const applicationFee = Math.round(amountInOre * getCreatorCommissionRate(creator.tier ?? "gratis"));
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://usha.se";
    const stripeLocale = await getStripeLocale();

    const session = await stripe.checkout.sessions.create({
      locale: stripeLocale,
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: "sek",
            product_data: { name: listing.title },
            unit_amount: amountInOre,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      payment_intent_data: {
        application_fee_amount: applicationFee,
        transfer_data: { destination: creator.stripe_account_id },
      },
      automatic_tax: { enabled: true },
      success_url: `${baseUrl}/flode?ticket=success`,
      cancel_url: `${baseUrl}/flode`,
      metadata: {
        // Reuse the existing webhook ticket branches; accessCodeId consumes the
        // use on payment success.
        type: user ? "ticket" : "guest_ticket",
        listingId: listing.id,
        creatorId: listing.user_id,
        accessCodeId: codeRow.id,
        eventDate: listing.event_date || "",
        eventTime: listing.event_time || "",
        ...(user
          ? { userId: user.id }
          : { guestEmail: email, guestName: name || "" }),
      },
    });

    return NextResponse.json({ url: session.url });
  }

  // ── FREE CODE → atomically consume one use, then book the free ticket ──
  const { data: codeId, error: rpcErr } = await admin.rpc("redeem_access_code", {
    p_listing: listingId,
    p_code: code,
  });
  if (rpcErr || !codeId) {
    return NextResponse.json({ error: te("invalidCode") }, { status: 400 });
  }

  const scheduledAt = listing.event_date
    ? new Date(`${listing.event_date}T${listing.event_time || "00:00:00"}`).toISOString()
    : new Date().toISOString();

  // Atomically reserve a seat (row-locked capacity check) before booking.
  const { data: reserved } = await admin.rpc("reserve_ticket", { p_listing: listingId });
  if (!reserved) {
    return NextResponse.json({ error: te("soldOut") }, { status: 403 });
  }

  const { data: codeBooking, error: bookErr } = await admin.from("bookings").insert({
    listing_id: listing.id,
    creator_id: listing.user_id,
    status: "confirmed",
    scheduled_at: scheduledAt,
    booking_type: "ticket",
    amount_paid: 0,
    is_free: true,
    ...(user ? { customer_id: user.id } : { guest_email: email, guest_name: name }),
  }).select("id").single();
  if (bookErr) {
    // Release the reserved seat on failure.
    await admin.rpc("increment_tickets_sold", { p_listing: listingId, p_n: -1 });
    console.error("access-code booking failed:", bookErr);
    return NextResponse.json({ error: te("generic") }, { status: 500 });
  }

  // Confirmation email (non-blocking; the free ticket is already booked).
  const { data: creator } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", listing.user_id)
    .maybeSingle();
  if (email) {
    sendBookingConfirmationEmail({
      to: email,
      customerName: name || "",
      serviceName: listing.title,
      scheduledAt: new Date(scheduledAt),
      creatorName: creator?.full_name || "Usha Platform",
      location: (listing as { event_location?: string }).event_location || undefined,
      bookingId: codeBooking?.id,
    }).catch((e) => console.error("access-code confirmation email failed:", e));
  }

  return NextResponse.json({ ok: true });
}
