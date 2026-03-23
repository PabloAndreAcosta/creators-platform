import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";
import { PLANS, type PlanKey } from "@/lib/stripe/config";
import { validatePromoCode, applyPromoDiscount } from "@/lib/promo/validate";

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
    const promoCode = body.promoCode as string | undefined;

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

    // Validate promo code if provided
    let stripeCouponId: string | undefined;
    let promoCodeId: string | undefined;
    let promoDiscountAmount: number | undefined;
    if (promoCode) {
      const validation = await validatePromoCode(
        promoCode,
        user.id,
        "subscription",
        planKey
      );

      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.error },
          { status: 400 }
        );
      }

      promoCodeId = validation.promo!.id;
      promoDiscountAmount = applyPromoDiscount(
        plan.price,
        validation.promo!.discount_type,
        validation.promo!.discount_value
      ).discountAmount;

      if (validation.promo!.stripe_coupon_id) {
        // Use existing Stripe coupon
        stripeCouponId = validation.promo!.stripe_coupon_id;
      } else {
        // Create a one-off Stripe coupon from the promo code
        const coupon = await stripe.coupons.create({
          ...(validation.promo!.discount_type === "percent"
            ? { percent_off: validation.promo!.discount_value }
            : { amount_off: Math.round(validation.promo!.discount_value * 100), currency: "sek" }),
          duration: "once",
          name: `Promo: ${validation.promo!.code}`,
        });
        stripeCouponId = coupon.id;
      }
    }

    // Check if this is a 100% discount (free trial)
    const isFreeWithPromo =
      promoDiscountAmount !== undefined && promoDiscountAmount >= plan.price;

    const sessionParams: any = {
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
        ...(promoCodeId && { promoCodeId }),
        ...(promoDiscountAmount && { promoDiscountAmount: String(promoDiscountAmount) }),
      },
    };

    if (isFreeWithPromo) {
      // 100% discount: use a 30-day trial so no payment method is needed
      sessionParams.subscription_data = { trial_period_days: 30 };
      sessionParams.payment_method_collection = "if_required";
    }

    if (stripeCouponId) {
      sessionParams.discounts = [{ coupon: stripeCouponId }];
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Checkout error:", error);
    const message = error?.message || "Kunde inte starta checkout";
    return NextResponse.json(
      { error: "Kunde inte starta checkout", detail: message },
      { status: 500 }
    );
  }
}
