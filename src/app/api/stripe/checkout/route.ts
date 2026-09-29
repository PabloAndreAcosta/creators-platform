import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";
import { PLANS, type PlanKey } from "@/lib/stripe/config";
import { validatePromoCode, applyPromoDiscount } from "@/lib/promo/validate";
import { BETA_MODE } from "@/lib/beta";
import { getStripeLocale } from "@/lib/i18n/stripe-locale";

export async function POST(req: NextRequest) {
  const { rateLimit, getRateLimitKey } = await import('@/lib/rate-limit');
  const rl = rateLimit(getRateLimitKey(req, 'stripe-checkout'), 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

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
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const plan = PLANS[planKey as PlanKey];

    // Avvecklade nivåer syns inte i prislistan men låg kvar i PLANS, och
    // nyckeln räckte för att teckna dem. Stripe-priset är oförändrat, så ett
    // anrop hit hade startat en prenumeration på 299 eller 599 kr på en nivå
    // som inte säljs längre. Att dölja något i gränssnittet är ingen spärr.
    if (plan.retired) {
      return NextResponse.json(
        { error: "Den här nivån säljs inte längre.", code: "plan_retired" },
        { status: 410 }
      );
    }
    const priceId = plan.stripePriceId;

    if (!priceId) {
      return NextResponse.json(
        { error: "Stripe price ID missing. Check environment variables." },
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

    // Provmånad för alla som tecknar medlemskap (beslut 2026-09-28).
    //
    // Tidigare gavs provperioden BARA under betan, och då 90 dagar. Det hade
    // två följder som båda var fel: den som tecknade i september fick tre
    // månader i stället för en, och från 1 oktober — när betan går ut — hade
    // nya medlemmar debiterats direkt utan någon prövotid alls.
    //
    // Inget kort krävs. Finns inget kort när månaden är slut faller
    // prenumerationen till past_due och webhooken nedgraderar till gratis av
    // sig själv, i stället för att debitera någon som glömt säga upp.
    const trialDays = parseInt(process.env.TRIAL_DAYS || "30", 10);
    sessionParams.subscription_data = { trial_period_days: trialDays };
    sessionParams.payment_method_collection = "if_required";

    if (stripeCouponId && !BETA_MODE) {
      sessionParams.discounts = [{ coupon: stripeCouponId }];
    }

    sessionParams.automatic_tax = { enabled: true };
    sessionParams.locale = await getStripeLocale();

    const session = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: "An error occurred. Please try again." },
      { status: 500 }
    );
  }
}
