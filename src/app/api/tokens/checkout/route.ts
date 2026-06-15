import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";
import { getPackage } from "@/lib/tokens/config";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";

/**
 * POST /api/tokens/checkout — buy a "nyckel" package.
 * One-time platform charge (no Connect transfer). The webhook credits the
 * token_ledger on checkout.session.completed (type=token_purchase).
 */
export async function POST(req: NextRequest) {
  const rl = rateLimit(getRateLimitKey(req, "tokens-checkout"), 10, 60_000);
  if (!rl.allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { packageId } = await req.json().catch(() => ({}));
  const pkg = getPackage(packageId);
  if (!pkg) return NextResponse.json({ error: "invalid_package" }, { status: 400 });

  try {
    const session = await stripe.checkout.sessions.create({
      customer_email: user.email,
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "sek",
            product_data: { name: `${pkg.tokens} nycklar` },
            unit_amount: pkg.priceSek * 100,
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/app/settings?nycklar=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/app/settings`,
      metadata: {
        type: "token_purchase",
        userId: user.id,
        packageId: pkg.id,
        tokens: String(pkg.tokens),
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Token checkout error:", error);
    return NextResponse.json({ error: "checkout_failed" }, { status: 500 });
  }
}
