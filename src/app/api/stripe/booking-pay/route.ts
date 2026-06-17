import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";
import { calculateDiscountedPrice, getCreatorCommissionRate } from "@/lib/stripe/commission";

const PAYABLE_AFTER_CONFIRM = new Set(["b2b_offering", "service"]);

/**
 * Creates a Stripe Checkout session for an already-confirmed booking that the
 * creator accepted but that hasn't been paid yet (a paid `service` such as a
 * private lesson, or a `b2b_offering`). The booking already exists; this route
 * only attaches a payment to it. On webhook completion, the booking row is
 * updated with stripe_payment_id and amount_paid (no new row created).
 */
export async function POST(req: NextRequest) {
  const { rateLimit, getRateLimitKey } = await import('@/lib/rate-limit');
  const rl = rateLimit(getRateLimitKey(req, 'stripe-booking-pay'), 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const { bookingId } = await req.json();

    if (!bookingId) {
      return NextResponse.json(
        { error: "bookingId is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userProfile } = await supabase
      .from("profiles")
      .select("tier")
      .eq("id", user.id)
      .single();
    const userTier = userProfile?.tier ?? null;

    const { data: booking } = await supabase
      .from("bookings")
      .select("id, listing_id, creator_id, customer_id, status, stripe_payment_id, agreed_price")
      .eq("id", bookingId)
      .single();

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (booking.customer_id !== user.id) {
      return NextResponse.json({ error: "Not authorized for this booking" }, { status: 403 });
    }

    if (booking.status !== "confirmed") {
      return NextResponse.json(
        { error: "Booking must be confirmed by the creator before payment" },
        { status: 400 }
      );
    }

    if (booking.stripe_payment_id) {
      return NextResponse.json(
        { error: "Booking is already paid" },
        { status: 400 }
      );
    }

    const { data: listing } = await supabase
      .from("listings")
      .select("id, title, price, listing_type, user_id")
      .eq("id", booking.listing_id)
      .single();

    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    if (!listing.listing_type || !PAYABLE_AFTER_CONFIRM.has(listing.listing_type)) {
      return NextResponse.json(
        { error: "This booking type cannot be paid here" },
        { status: 400 }
      );
    }

    // Resolve effective price: prefer the negotiated agreed_price on the booking
    // (B2B), otherwise the listing price with the buyer's membership discount
    // applied — matching what they were shown when booking.
    const agreedPrice = (booking as { agreed_price?: number | null }).agreed_price ?? null;
    const effectivePrice =
      agreedPrice != null && agreedPrice > 0
        ? agreedPrice
        : calculateDiscountedPrice(listing.price ?? 0, userTier);

    if (!effectivePrice || effectivePrice <= 0) {
      return NextResponse.json(
        { error: "Listing has no price" },
        { status: 400 }
      );
    }

    const { data: creator } = await supabase
      .from("profiles")
      .select("stripe_account_id, tier, creator_subcategory")
      .eq("id", listing.user_id)
      .single();

    if (!creator?.stripe_account_id) {
      return NextResponse.json(
        { error: "Creator has not connected their Stripe account" },
        { status: 400 }
      );
    }

    const amountInOre = Math.round(effectivePrice * 100);
    const creatorSubcategory = (creator as { creator_subcategory?: string | null }).creator_subcategory ?? null;
    const commissionRate = getCreatorCommissionRate(creator.tier ?? "gratis", creatorSubcategory);
    const applicationFee = Math.round(amountInOre * commissionRate);

    const session = await stripe.checkout.sessions.create({
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: "sek",
            product_data: {
              name: `Bokning: ${listing.title}`,
            },
            unit_amount: amountInOre,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      payment_intent_data: {
        application_fee_amount: applicationFee,
        transfer_data: {
          destination: creator.stripe_account_id,
        },
      },
      automatic_tax: { enabled: true },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/bookings?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/bookings`,
      metadata: {
        type: "b2b_payment",
        bookingId: booking.id,
        userId: user.id,
        creatorId: listing.user_id,
        listingId: listing.id,
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error: unknown) {
    console.error("B2B booking-pay error:", error);
    return NextResponse.json(
      { error: "An error occurred. Please try again." },
      { status: 500 }
    );
  }
}
