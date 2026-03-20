import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/client';
import { createClient } from '@/lib/supabase/server';
import {
  calculateDiscountedPrice,
  getCreatorCommissionRate,
} from '@/lib/stripe/commission';
import { isGoldExclusive } from '@/lib/listings/early-bird';

export async function POST(req: NextRequest) {
  try {
    const { listingId } = await req.json();

    if (!listingId) {
      return NextResponse.json(
        { error: 'listingId krävs' },
        { status: 400 }
      );
    }

    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's tier from profile
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('tier')
      .eq('id', user.id)
      .single();

    const userTier = userProfile?.tier ?? null;

    // Get listing details
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('id, title, price, user_id, is_active, event_date, event_time, release_to_gold_at')
      .eq('id', listingId)
      .single();

    if (listingError || !listing) {
      return NextResponse.json(
        { error: 'Evenemang hittades inte' },
        { status: 404 }
      );
    }

    if (!listing.is_active) {
      return NextResponse.json(
        { error: 'Evenemanget är inte aktivt' },
        { status: 400 }
      );
    }

    // Early bird: block gratis users during Gold-exclusive window
    if (listing.release_to_gold_at) {
      const releaseDate = new Date(listing.release_to_gold_at);
      if (isGoldExclusive(releaseDate) && userTier !== 'guld' && userTier !== 'premium') {
        const hours = Math.ceil((releaseDate.getTime() - Date.now()) / (60 * 60 * 1000));
        return NextResponse.json(
          { error: `Detta event är exklusivt för Guld/Premium-medlemmar i ${hours} timmar till.` },
          { status: 403 }
        );
      }
    }

    if (!listing.price || listing.price <= 0) {
      return NextResponse.json(
        { error: 'Evenemanget har inget pris' },
        { status: 400 }
      );
    }

    // Get creator profile (for Connect account and tier)
    const { data: creator } = await supabase
      .from('profiles')
      .select('stripe_account_id, tier')
      .eq('id', listing.user_id)
      .single();

    if (!creator?.stripe_account_id) {
      return NextResponse.json(
        { error: 'Kreatören har inte kopplat sitt Stripe-konto' },
        { status: 400 }
      );
    }

    // Calculate pricing
    const originalPrice = listing.price;
    const discountedPrice = calculateDiscountedPrice(originalPrice, userTier);
    const amountInOre = Math.round(discountedPrice * 100);
    const commissionRate = getCreatorCommissionRate(creator.tier ?? 'gratis');
    const applicationFee = Math.round(amountInOre * commissionRate);

    // Create Stripe Checkout session with Connect split
    const session = await stripe.checkout.sessions.create({
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: 'sek',
            product_data: {
              name: listing.title,
            },
            unit_amount: amountInOre,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      payment_intent_data: {
        application_fee_amount: applicationFee,
        transfer_data: {
          destination: creator.stripe_account_id,
        },
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/app/tickets?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/creators/${listing.user_id}`,
      metadata: {
        type: 'ticket',
        listingId: listing.id,
        userId: user.id,
        creatorId: listing.user_id,
        originalPrice: String(originalPrice),
        discountedPrice: String(discountedPrice),
        eventDate: listing.event_date || '',
        eventTime: listing.event_time || '',
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error('Ticket checkout error:', error);
    const message = error?.message || 'Kunde inte starta checkout';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
