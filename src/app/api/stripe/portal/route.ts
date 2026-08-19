import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";
import { isRealStripeCustomer } from "@/lib/stripe/customer";

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find the user's Stripe customer ID from their subscription
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .not("stripe_customer_id", "is", null)
      .single();

    if (!subscription?.stripe_customer_id) {
      return NextResponse.json({ error: "No subscription found", reason: "none" }, { status: 404 });
    }

    // A comp subscription has no Stripe customer behind it, so there is nothing
    // for the portal to manage. Say that plainly instead of forwarding the
    // placeholder to Stripe and turning its rejection into a 500.
    if (!isRealStripeCustomer(subscription.stripe_customer_id)) {
      return NextResponse.json(
        { error: "This subscription is not billed through Stripe", reason: "comp" },
        { status: 409 }
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Portal error:", error);
    return NextResponse.json(
      { error: "Could not open customer portal" },
      { status: 500 }
    );
  }
}
