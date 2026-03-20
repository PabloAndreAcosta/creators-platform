import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";
import {
  calculateDiscountedPrice,
  getCreatorCommissionRate,
} from "@/lib/stripe/commission";

/**
 * Creates a Stripe Checkout session for a paid manual booking.
 * Unlike ticket-checkout (auto-confirmed), this creates a pending booking
 * that the creator must confirm. If canceled, payment is refunded.
 */
export async function POST(req: NextRequest) {
  try {
    const {
      listingId,
      creatorId,
      scheduledAt,
      notes,
      guestCount,
      specialRequests,
      attendees,
      promoCode,
    } = await req.json();

    if (!listingId || !creatorId || !scheduledAt) {
      return NextResponse.json(
        { error: "Listing, creator och datum krävs" },
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

    if (creatorId === user.id) {
      return NextResponse.json(
        { error: "Du kan inte boka din egen tjänst" },
        { status: 400 }
      );
    }

    // Get user tier
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("tier")
      .eq("id", user.id)
      .single();
    const userTier = userProfile?.tier ?? null;

    // Get listing
    const { data: listing } = await supabase
      .from("listings")
      .select("id, title, price, user_id, is_active, min_guests, max_guests")
      .eq("id", listingId)
      .single();

    if (!listing || !listing.is_active) {
      return NextResponse.json(
        { error: "Tjänsten hittades inte eller är inaktiv" },
        { status: 404 }
      );
    }

    if (!listing.price || listing.price <= 0) {
      return NextResponse.json(
        { error: "Tjänsten har inget pris" },
        { status: 400 }
      );
    }

    // Validate guest count
    const guests = guestCount ?? 1;
    if (listing.min_guests && guests < listing.min_guests) {
      return NextResponse.json(
        { error: `Minst ${listing.min_guests} gäster krävs` },
        { status: 400 }
      );
    }
    if (listing.max_guests && guests > listing.max_guests) {
      return NextResponse.json(
        { error: `Max ${listing.max_guests} gäster tillåtna` },
        { status: 400 }
      );
    }

    // Get creator's Stripe Connect account
    const { data: creator } = await supabase
      .from("profiles")
      .select("stripe_account_id, tier")
      .eq("id", listing.user_id)
      .single();

    if (!creator?.stripe_account_id) {
      return NextResponse.json(
        { error: "Kreatören har inte kopplat sitt Stripe-konto" },
        { status: 400 }
      );
    }

    // Calculate pricing
    const originalPrice = listing.price;
    const discountedPrice = calculateDiscountedPrice(originalPrice, userTier);
    const amountInOre = Math.round(discountedPrice * 100);
    const commissionRate = getCreatorCommissionRate(creator.tier ?? "gratis");
    const applicationFee = Math.round(amountInOre * commissionRate);

    // Validate promo code if provided
    let promoCodeId: string | undefined;
    let promoDiscountAmount: number | undefined;
    if (promoCode) {
      const { validatePromoCode, applyPromoDiscount } = await import(
        "@/lib/promo/validate"
      );
      const validation = await validatePromoCode(promoCode, user.id, "ticket");
      if (validation.valid && validation.promo) {
        const result = applyPromoDiscount(
          discountedPrice,
          validation.promo.discount_type,
          validation.promo.discount_value
        );
        promoDiscountAmount = result.discountAmount;
        promoCodeId = validation.promo.id;
      }
    }

    const finalAmount = promoDiscountAmount
      ? Math.round((discountedPrice - promoDiscountAmount) * 100)
      : amountInOre;
    const finalFee = Math.round(finalAmount * commissionRate);

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: "sek",
            product_data: {
              name: `Bokning: ${listing.title}`,
              description: guests > 1 ? `${guests} gäster` : undefined,
            },
            unit_amount: finalAmount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      payment_intent_data: {
        application_fee_amount: finalFee,
        transfer_data: {
          destination: creator.stripe_account_id,
        },
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/bookings?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/creators/${listing.user_id}`,
      metadata: {
        type: "paid_booking",
        listingId: listing.id,
        userId: user.id,
        creatorId: listing.user_id,
        scheduledAt,
        notes: notes || "",
        guestCount: String(guests),
        specialRequests: specialRequests || "",
        attendees: attendees ? JSON.stringify(attendees) : "[]",
        originalPrice: String(originalPrice),
        discountedPrice: String(discountedPrice),
        ...(promoCodeId && { promoCodeId }),
        ...(promoDiscountAmount && {
          promoDiscountAmount: String(promoDiscountAmount),
        }),
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error("Booking checkout error:", error);
    return NextResponse.json(
      { error: "Kunde inte starta betalning" },
      { status: 500 }
    );
  }
}
