import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/client';
import { createClient } from '@/lib/supabase/server';
import { calculateDiscountedPrice } from '@/lib/stripe/commission';

export async function POST(req: NextRequest) {
  try {
    const { eventId, userId } = await req.json();

    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's tier from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('tier')
      .eq('id', userId || user.id)
      .single();

    const userTier = profile?.tier ?? null;

    // Get event/listing details
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('id, title, price, event_tier, user_id')
      .eq('id', eventId)
      .single();

    if (listingError || !listing) {
      console.error('Event not found:', eventId, listingError);
      return NextResponse.json({ error: 'Event hittades inte' }, { status: 404 });
    }

    const originalPrice = listing.price ?? 0;
    const discountedPrice = calculateDiscountedPrice(
      originalPrice,
      userTier,
      listing.event_tier
    );
    const discountPercent =
      originalPrice > 0
        ? Math.round((1 - discountedPrice / originalPrice) * 100)
        : 0;

    // Create Stripe checkout session with one-time payment
    const session = await stripe.checkout.sessions.create({
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: 'sek',
            product_data: {
              name: listing.title,
              metadata: { eventId, eventTier: listing.event_tier },
            },
            unit_amount: Math.round(discountedPrice * 100), // SEK to öre
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/app/tickets?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/app`,
      metadata: {
        eventId,
        userId: user.id,
        creatorId: listing.user_id,
        originalPrice: String(originalPrice),
        discountedPrice: String(discountedPrice),
        discountPercent: String(discountPercent),
        userTier: userTier ?? 'none',
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Discount checkout error:', error);
    return NextResponse.json(
      { error: 'Kunde inte starta checkout' },
      { status: 500 }
    );
  }
}
