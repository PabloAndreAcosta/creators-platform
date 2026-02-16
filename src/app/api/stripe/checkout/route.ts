import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";
import { PLANS, type PlanKey } from "@/lib/stripe/config";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Support both planKey (new) and priceId+planName (legacy)
    let priceId: string;
    let planName: string;

    if (body.planKey && body.planKey in PLANS) {
      const key = body.planKey as PlanKey;
      priceId = PLANS[key].stripePriceId;
      planName = key;
    } else if (body.priceId) {
      priceId = body.priceId;
      planName = body.planName || "basic";
    } else {
      return NextResponse.json({ error: "Missing plan" }, { status: 400 });
    }

    if (!priceId) {
      return NextResponse.json(
        { error: "Stripe price ID saknas. Kontrollera miljövariabler." },
        { status: 500 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      customer_email: user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing`,
      metadata: {
        userId: user.id,
        plan: planName,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: "Kunde inte starta checkout" },
      { status: 500 }
    );
  }
}
