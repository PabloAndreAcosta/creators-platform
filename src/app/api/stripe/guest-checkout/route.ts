import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";
import {
  getCreatorCommissionRate,
} from "@/lib/stripe/commission";

export async function POST(req: NextRequest) {
  try {
    const { listingId, email, name } = await req.json();

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
      .select("id, title, price, user_id, is_active, event_date, event_time")
      .eq("id", listingId)
      .eq("is_active", true)
      .single();

    if (!listing) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    // Free tickets — create booking directly
    if (!listing.price || listing.price <= 0) {
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

      await admin.from("bookings").insert({
        listing_id: listing.id,
        creator_id: listing.user_id,
        customer_id: null,
        guest_email: email,
        guest_name: name || null,
        status: "confirmed",
        scheduled_at: scheduledAt,
        booking_type: "ticket",
        amount_paid: 0,
      });

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://usha.se";
      return NextResponse.json({
        url: `${baseUrl}/flode?ticket=success`,
      });
    }

    // Get creator for Connect account
    const { data: creator } = await supabase
      .from("profiles")
      .select("stripe_account_id, tier")
      .eq("id", listing.user_id)
      .single();

    if (!creator?.stripe_account_id) {
      return NextResponse.json(
        { error: "Creator has not connected their Stripe account" },
        { status: 400 }
      );
    }

    const amountInOre = Math.round(listing.price * 100);
    const commissionRate = getCreatorCommissionRate(creator.tier ?? "gratis");
    const applicationFee = Math.round(amountInOre * commissionRate);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://usha.se";

    const session = await stripe.checkout.sessions.create({
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
        eventDate: listing.event_date || "",
        eventTime: listing.event_time || "",
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Guest checkout error:", error);
    return NextResponse.json(
      { error: error?.message || "Server error" },
      { status: 500 }
    );
  }
}
