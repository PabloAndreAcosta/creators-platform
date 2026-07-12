import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripeLocale } from "@/lib/i18n/stripe-locale";
import { stripe } from "@/lib/stripe/client";
import { computeServiceFeeOre, serviceFeeMode } from "@/lib/tickets/service-fee";
import { clampQuantity, createTicketAttendees } from "@/lib/tickets/attendees";
import { createClient } from "@/lib/supabase/server";
import { getSaleState } from "@/lib/listings/sale-state";
import { getTranslations } from "next-intl/server";
import {
  getCreatorCommissionRate,
} from "@/lib/stripe/commission";
import { canReceivePayments, PAYMENTS_BETA_BLOCKED_MESSAGE } from "@/lib/payments/beta-gate";

export async function POST(req: NextRequest) {
  // Rate limit: 5 guest checkouts per minute per IP
  const { rateLimit, getRateLimitKey } = await import('@/lib/rate-limit');
  const rl = rateLimit(getRateLimitKey(req, 'guest-checkout'), 5, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const { listingId, email, name, ticketTypeId, quantity } = await req.json();
    const qty = clampQuantity(quantity);

    if (!listingId || !email) {
      return NextResponse.json(
        { error: "listingId and email are required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Fetch listing
    const { data: listing } = await supabase
      .from("listings")
      .select("id, title, price, user_id, is_active, event_date, event_time, event_location, early_bird_start, early_bird_end, early_bird_price, public_sale_at, capacity, tickets_sold, service_fee_mode")
      .eq("id", listingId)
      .eq("is_active", true)
      .single();

    if (!listing) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    // Optional ticket type (price tier) — overrides price + capacity, validated
    // to belong to this listing.
    let ticketType: { id: string; name: string; price: number; capacity: number | null; tickets_sold: number } | null = null;
    if (ticketTypeId) {
      const { data: tt } = await supabase
        .from("ticket_types")
        .select("id, name, price, capacity, tickets_sold")
        .eq("id", ticketTypeId)
        .eq("listing_id", listing.id)
        .single();
      if (!tt) {
        return NextResponse.json({ error: "Invalid ticket type" }, { status: 400 });
      }
      ticketType = tt as { id: string; name: string; price: number; capacity: number | null; tickets_sold: number };
      if (ticketType!.capacity != null && ticketType!.tickets_sold >= ticketType!.capacity) {
        return NextResponse.json({ error: "Slutsålt." }, { status: 403 });
      }
    }

    // Timed automation: block when not buyable; use effective (early-bird) price.
    const sale = getSaleState(listing, new Date());
    if (!sale.buyable) {
      const te = await getTranslations("eventErrors");
      const msg = sale.state === "before" ? te("notReleased") : te("soldOut");
      return NextResponse.json({ error: msg }, { status: 403 });
    }

    // A selected ticket type sets its own price; otherwise the listing price.
    const effectivePrice = ticketType ? ticketType.price : sale.price;

    // Free tickets — create booking directly
    if (!effectivePrice || effectivePrice <= 0) {
      const { createClient: createAdmin } = await import("@supabase/supabase-js");
      const admin = createAdmin(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      let scheduledAt: string;
      if (listing.event_date) {
        scheduledAt = listing.event_time
          ? new Date(`${listing.event_date}T${listing.event_time}`).toISOString()
          : new Date(`${listing.event_date}T00:00:00`).toISOString();
      } else {
        scheduledAt = new Date().toISOString();
      }

      // Duplicate guard: a double-tap/retry should not issue a second ticket to
      // the same email. Return the existing ticket link if one already exists.
      const baseUrlDup = process.env.NEXT_PUBLIC_APP_URL || "https://usha.se";
      const { data: existingTicket } = await admin
        .from("bookings")
        .select("id")
        .eq("listing_id", listing.id)
        .eq("guest_email", email)
        .eq("booking_type", "ticket")
        .neq("status", "canceled")
        .limit(1)
        .maybeSingle();
      if (existingTicket) {
        return NextResponse.json({ url: `${baseUrlDup}/biljett/${existingTicket.id}` });
      }

      // Atomically reserve a seat (row-locked capacity check) before creating
      // the booking, so concurrent guests can't oversell.
      const { data: reserved } = await admin.rpc("reserve_ticket", { p_listing: listing.id, p_ticket_type: ticketType?.id ?? undefined, p_n: qty });
      if (!reserved) {
        return NextResponse.json({ error: "Slutsålt." }, { status: 403 });
      }

      const { data: booking, error: bookingError } = await admin
        .from("bookings")
        .insert({
          listing_id: listing.id,
          creator_id: listing.user_id,
          customer_id: null,
          guest_email: email,
          guest_name: name || null,
          status: "confirmed",
          scheduled_at: scheduledAt,
          booking_type: "ticket",
          amount_paid: 0,
          is_free: true,
          guest_count: qty,
          ticket_type_id: ticketType?.id ?? null,
          ticket_type_name: ticketType?.name ?? null,
        })
        .select("id")
        .single();

      // Release the reserved seats if the booking failed to persist.
      if (bookingError || !booking?.id) {
        await admin.rpc("increment_tickets_sold", { p_listing: listing.id, p_n: -qty, p_ticket_type: ticketType?.id ?? undefined });
        return NextResponse.json({ error: "Kunde inte skapa bokningen." }, { status: 500 });
      }

      // One scannable attendee per seat (only for multi-ticket orders).
      await createTicketAttendees(admin, booking.id, qty);

      // Send the confirmation email with the ticket QR + public ticket link.
      // Without this, free guests got no email at all and no way to show a QR.
      const { data: creator } = await admin
        .from("profiles")
        .select("full_name")
        .eq("id", listing.user_id)
        .maybeSingle();
      const { sendBookingConfirmationEmail } = await import("@/lib/email/send-booking");
      sendBookingConfirmationEmail({
        to: email,
        customerName: name || "Gäst",
        serviceName: listing.title,
        scheduledAt: new Date(scheduledAt),
        creatorName: creator?.full_name || "Usha Platform",
        location: (listing as { event_location?: string }).event_location || undefined,
        bookingId: booking?.id,
      }).catch((e) => console.error("guest free-ticket confirmation email failed:", e));

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://usha.se";
      return NextResponse.json({
        url: booking?.id ? `${baseUrl}/biljett/${booking.id}` : `${baseUrl}/flode?ticket=success`,
      });
    }

    // Get creator for Connect account
    const { data: creator } = await supabase
      .from("profiles")
      .select("stripe_account_id, tier, company_verified_at")
      .eq("id", listing.user_id)
      .single();

    if (!creator?.stripe_account_id) {
      return NextResponse.json(
        { error: "Creator has not connected their Stripe account" },
        { status: 400 }
      );
    }

    if (!canReceivePayments({ id: listing.user_id, company_verified_at: creator.company_verified_at })) {
      return NextResponse.json({ error: PAYMENTS_BETA_BLOCKED_MESSAGE }, { status: 403 });
    }

    const amountInOre = Math.round(effectivePrice * 100);
    const commissionRate = getCreatorCommissionRate(creator.tier ?? "gratis");
    const applicationFee = Math.round(amountInOre * commissionRate);

    // Tickster-style service fee (gated off until the flag is set). Fee is added
    // to the application_fee in both modes; "buyer" mode also adds a line item.
    const feeMode = serviceFeeMode(listing.service_fee_mode);
    const serviceFee = computeServiceFeeOre(amountInOre, qty); // total for all N tickets
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: "sek",
          product_data: { name: ticketType ? `${listing.title} – ${ticketType.name}` : listing.title },
          unit_amount: amountInOre,
        },
        quantity: qty,
      },
    ];
    if (serviceFee > 0 && feeMode === "buyer") {
      lineItems.push({
        price_data: {
          currency: "sek",
          product_data: { name: "Serviceavgift" },
          unit_amount: serviceFee,
        },
        quantity: 1,
      });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://usha.se";

    const stripeLocale = await getStripeLocale();
    const session = await stripe.checkout.sessions.create({
      locale: stripeLocale,
      customer_email: email,
      line_items: lineItems,
      mode: "payment",
      payment_intent_data: {
        application_fee_amount: applicationFee * qty + serviceFee,
        transfer_data: {
          destination: creator.stripe_account_id,
        },
      },
      automatic_tax: { enabled: true },
      success_url: `${baseUrl}/flode?ticket=success`,
      cancel_url: `${baseUrl}/flode`,
      metadata: {
        type: "guest_ticket",
        listingId: listing.id,
        creatorId: listing.user_id,
        guestEmail: email,
        guestName: name || "",
        serviceFeeOre: String(serviceFee),
        serviceFeeMode: feeMode,
        ticketTypeId: ticketType?.id ?? "",
        ticketTypeName: ticketType?.name ?? "",
        quantity: String(qty),
        eventDate: listing.event_date || "",
        eventTime: listing.event_time || "",
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Guest checkout error:", error);
    return NextResponse.json(
      { error: "An error occurred. Please try again." },
      { status: 500 }
    );
  }
}
