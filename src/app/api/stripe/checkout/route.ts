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

    const planKey = body.planKey as string;

    if (!planKey || !(planKey in PLANS)) {
      return NextResponse.json({ error: "Ogiltig plan" }, { status: 400 });
    }

    const plan = PLANS[planKey as PlanKey];
    const priceId = plan.stripePriceId;

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
        plan: planKey,
        role: plan.role,
        tier: plan.tier,
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
