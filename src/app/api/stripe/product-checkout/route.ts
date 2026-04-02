import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-04-10" as any });

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 });
    }

    const { productId, promoCode } = await req.json();

    if (!productId) {
      return NextResponse.json({ error: "Produkt-ID krävs" }, { status: 400 });
    }

    // Fetch the product
    const { data: product } = await supabase
      .from("digital_products")
      .select("id, title, description, price, creator_id, is_active")
      .eq("id", productId)
      .single();

    if (!product || !product.is_active) {
      return NextResponse.json({ error: "Produkt hittades inte" }, { status: 404 });
    }

    // Check if already purchased
    const { data: existingPurchase } = await supabase
      .from("digital_purchases")
      .select("id")
      .eq("product_id", productId)
      .eq("buyer_id", user.id)
      .single();

    if (existingPurchase) {
      return NextResponse.json({ error: "Du har redan köpt denna produkt" }, { status: 400 });
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

    // Create Stripe checkout session
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://usha.se";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "sek",
            product_data: {
              name: product.title,
              description: product.description || undefined,
            },
            unit_amount: finalPrice * 100, // Convert to öre
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
      success_url: `${baseUrl}/app/library?purchased=${productId}`,
      cancel_url: `${baseUrl}/creators/${product.creator_id}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Product checkout error:", error);
    return NextResponse.json({ error: "Serverfel" }, { status: 500 });
  }
}
