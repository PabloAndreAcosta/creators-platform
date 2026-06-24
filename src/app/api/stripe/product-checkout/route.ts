import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";
import { getCreatorCommissionRate } from "@/lib/stripe/commission";
import { canReceivePayments, PAYMENTS_BETA_BLOCKED_MESSAGE } from "@/lib/payments/beta-gate";

export async function POST(req: NextRequest) {
  const { rateLimit, getRateLimitKey } = await import('@/lib/rate-limit');
  const rl = rateLimit(getRateLimitKey(req, 'product-checkout'), 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { productId, promoCode } = await req.json();

    if (!productId) {
      return NextResponse.json({ error: "Product ID is required" }, { status: 400 });
    }

    // Fetch the product
    const { data: product } = await supabase
      .from("digital_products")
      .select("id, title, description, price, creator_id, is_active")
      .eq("id", productId)
      .single();

    if (!product || !product.is_active) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Check if already purchased
    const { data: existingPurchase } = await supabase
      .from("digital_purchases")
      .select("id")
      .eq("product_id", productId)
      .eq("buyer_id", user.id)
      .single();

    if (existingPurchase) {
      return NextResponse.json({ error: "You have already purchased this product" }, { status: 400 });
    }

    // Check promo code
    let discount = 0;
    let creatorPromoId: string | null = null;
    if (promoCode) {
      const { data: promo } = await supabase
        .from("creator_promo_codes")
        .select("id, creator_id, discount_percent, discount_amount, max_uses, times_used, is_active, valid_until")
        .eq("code", promoCode.toUpperCase())
        .eq("is_active", true)
        .single();

      if (promo) {
        // Verify promo code belongs to the same creator as the product
        if (promo.creator_id !== product.creator_id) {
          return NextResponse.json({ error: "Promo code is not valid for this product" }, { status: 400 });
        }
        const now = new Date();
        const validUntil = promo.valid_until ? new Date(promo.valid_until) : null;
        if ((!validUntil || validUntil > now) && (!promo.max_uses || promo.times_used < promo.max_uses)) {
          if (promo.discount_percent > 0) {
            discount = Math.round(product.price * promo.discount_percent / 100);
          } else if (promo.discount_amount > 0) {
            discount = promo.discount_amount;
          }
          creatorPromoId = promo.creator_id;
        }
      }
    }

    const finalPrice = Math.max(product.price - discount, 0);

    // If free after discount, record purchase directly
    if (finalPrice === 0) {
      await supabase.from("digital_purchases").insert({
        product_id: productId,
        buyer_id: user.id,
        amount_paid: 0,
        promo_code: promoCode || null,
        creator_promo_id: creatorPromoId,
      });

      // Increment promo usage
      if (promoCode && creatorPromoId) {
        try {
          await supabase
            .from("creator_promo_codes")
            .update({ times_used: (await supabase.from("creator_promo_codes").select("times_used").eq("code", promoCode.toUpperCase()).single()).data?.times_used + 1 } as any)
            .eq("code", promoCode.toUpperCase());
        } catch {}
      }

      return NextResponse.json({ url: `/app/library?purchased=${productId}` });
    }

    // Paid digital product → destination charge to the creator's Connect account
    // so the gross goes to the creator and only the commission lands on Usha
    // (§1.1 / G4 — gross must never land on Usha's account).
    const { data: creator } = await supabase
      .from("profiles")
      .select("stripe_account_id, tier, creator_subcategory, company_verified_at")
      .eq("id", product.creator_id)
      .single();

    if (!creator?.stripe_account_id) {
      return NextResponse.json({ error: "Kreatören har inte kopplat Stripe ännu." }, { status: 400 });
    }
    if (!canReceivePayments({ id: product.creator_id, company_verified_at: creator.company_verified_at })) {
      return NextResponse.json({ error: PAYMENTS_BETA_BLOCKED_MESSAGE }, { status: 403 });
    }

    const commissionRate = getCreatorCommissionRate(
      creator.tier ?? "gratis",
      (creator as { creator_subcategory?: string | null }).creator_subcategory ?? null,
    );
    const amountOre = finalPrice * 100;
    const applicationFee = Math.round(amountOre * commissionRate);

    // Create Stripe checkout session
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://usha.se";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      // Inga pinnade payment_method_types — Stripe visar de metoder som aktiverats
      // i Dashboard (kort, Swish, Klarna) för behöriga SE/SEK-kunder, som övriga flöden.
      payment_intent_data: {
        application_fee_amount: applicationFee,
        transfer_data: { destination: creator.stripe_account_id },
      },
      line_items: [
        {
          price_data: {
            currency: "sek",
            product_data: {
              name: product.title,
              description: product.description || undefined,
            },
            unit_amount: amountOre, // öre
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: "digital_product",
        product_id: productId,
        buyer_id: user.id,
        creator_id: product.creator_id,
        promo_code: promoCode || "",
        creator_promo_id: creatorPromoId || "",
      },
      automatic_tax: { enabled: true },
      success_url: `${baseUrl}/app/library?purchased=${productId}`,
      cancel_url: `${baseUrl}/creators/${product.creator_id}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Product checkout error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
