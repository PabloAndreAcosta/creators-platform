import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/client';
import { createClient } from '@/lib/supabase/server';

const TIER_PRICES: Record<string, { priceId: string; name: string }> = {
  gold: {
    priceId: process.env.STRIPE_CREATOR_GOLD_PRICE_ID || '',
    name: 'Creator Gold',
  },
  platinum: {
    priceId: process.env.STRIPE_CREATOR_PLATINUM_PRICE_ID || '',
    name: 'Creator Platinum',
  },
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tier } = await req.json();

    if (!tier || !TIER_PRICES[tier]) {
      return NextResponse.json(
        { error: 'Ogiltig tier. Välj gold eller platinum.' },
        { status: 400 }
      );
    }

    const tierConfig = TIER_PRICES[tier];

    if (!tierConfig.priceId) {
      return NextResponse.json(
        { error: 'Stripe price ID saknas. Kontrollera miljövariabler.' },
        { status: 500 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      customer_email: user.email,
      line_items: [{ price: tierConfig.priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?tier_upgraded=${tier}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing`,
      metadata: {
        userId: user.id,
        type: 'creator_tier',
        tier,
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Creator subscribe error:', error);
    return NextResponse.json(
      { error: 'Kunde inte starta checkout' },
      { status: 500 }
    );
  }
}
