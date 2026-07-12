import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripeLocale } from "@/lib/i18n/stripe-locale";
import { stripe } from '@/lib/stripe/client';
import { computeServiceFeeOre, serviceFeeMode } from '@/lib/tickets/service-fee';
import { clampQuantity, createTicketAttendees } from '@/lib/tickets/attendees';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getSaleState } from '@/lib/listings/sale-state';
import { getTranslations } from 'next-intl/server';
import {
  calculateDiscountedPrice,
  getCreatorCommissionRate,
} from '@/lib/stripe/commission';
import { isGoldExclusive } from '@/lib/listings/early-bird';
import { canReceivePayments, PAYMENTS_BETA_BLOCKED_MESSAGE } from '@/lib/payments/beta-gate';

export async function POST(req: NextRequest) {
  const { rateLimit, getRateLimitKey } = await import('@/lib/rate-limit');
  const rl = rateLimit(getRateLimitKey(req, 'stripe-ticket-checkout'), 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const { listingId, ticketTypeId, quantity } = await req.json();
    const qty = clampQuantity(quantity);

    if (!listingId) {
      return NextResponse.json(
        { error: 'listingId is required' },
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
      .select('id, title, price, user_id, is_active, event_date, event_time, release_to_gold_at, early_bird_start, early_bird_end, early_bird_price, public_sale_at, capacity, tickets_sold, service_fee_mode')
      .eq('id', listingId)
      .single();

    if (listingError || !listing) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    if (!listing.is_active) {
      return NextResponse.json(
        { error: 'Event is not active' },
        { status: 400 }
      );
    }

    if (listing.user_id === user.id) {
      return NextResponse.json(
        { error: 'You cannot buy a ticket to your own event' },
        { status: 400 }
      );
    }

    // Optional ticket type (price tier). When present it overrides the price and
    // capacity for this purchase; validated to belong to this listing.
    let ticketType: { id: string; name: string; price: number; capacity: number | null; tickets_sold: number } | null = null;
    if (ticketTypeId) {
      const { data: tt } = await supabase
        .from('ticket_types')
        .select('id, name, price, capacity, tickets_sold')
        .eq('id', ticketTypeId)
        .eq('listing_id', listing.id)
        .single();
      if (!tt) {
        return NextResponse.json({ error: 'Invalid ticket type' }, { status: 400 });
      }
      ticketType = tt as { id: string; name: string; price: number; capacity: number | null; tickets_sold: number };
      if (ticketType!.capacity != null && ticketType!.tickets_sold >= ticketType!.capacity) {
        const te = await getTranslations('eventErrors');
        return NextResponse.json({ error: te('soldOut') }, { status: 403 });
      }
    }

    // Prevent duplicate ticket purchases for the same event
    const { count: existingTickets } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('listing_id', listingId)
      .eq('customer_id', user.id)
      .eq('booking_type', 'ticket')
      .in('status', ['pending', 'confirmed']);

    if (existingTickets && existingTickets > 0) {
      return NextResponse.json(
        { error: 'You already have a ticket for this event' },
        { status: 409 }
      );
    }

    // Early bird: block gratis users during Gold-exclusive window
    if (listing.release_to_gold_at) {
      const releaseDate = new Date(listing.release_to_gold_at);
      if (isGoldExclusive(releaseDate) && userTier !== 'guld' && userTier !== 'premium') {
        const hours = Math.ceil((releaseDate.getTime() - Date.now()) / (60 * 60 * 1000));
        return NextResponse.json(
          { error: `This event is exclusive to Gold/Premium members for another ${hours} hours.` },
          { status: 403 }
        );
      }
    }

    // Timed automation: block when not buyable (sold out / not released yet)
    // and use the effective price (early-bird price during the window).
    const sale = getSaleState(listing, new Date());
    if (!sale.buyable) {
      const te = await getTranslations('eventErrors');
      const msg = sale.state === 'before' ? te('notReleased') : te('soldOut');
      return NextResponse.json({ error: msg }, { status: 403 });
    }

    // A selected ticket type sets its own price; otherwise the listing price
    // (honouring the early-bird window) applies.
    const effectivePrice = ticketType ? ticketType.price : sale.price;

    // Free tickets — create booking directly without Stripe
    if (!effectivePrice || effectivePrice <= 0) {
      // Atomically reserve a seat (row-locked capacity check) so concurrent
      // free-ticket requests can't oversell the event (or the ticket type).
      const { data: reserved } = await supabase.rpc('reserve_ticket', { p_listing: listing.id, p_ticket_type: ticketType?.id ?? undefined, p_n: qty });
      if (!reserved) {
        const te = await getTranslations('eventErrors');
        return NextResponse.json({ error: te('soldOut') }, { status: 403 });
      }

      let scheduledAt: string;
      if (listing.event_date) {
        scheduledAt = listing.event_time
          ? new Date(`${listing.event_date}T${listing.event_time}`).toISOString()
          : new Date(`${listing.event_date}T00:00:00`).toISOString();
      } else {
        scheduledAt = new Date().toISOString();
      }

      const { data: freeBooking, error: insertError } = await supabase.from('bookings').insert({
        listing_id: listing.id,
        creator_id: listing.user_id,
        customer_id: user.id,
        status: 'confirmed',
        scheduled_at: scheduledAt,
        booking_type: 'ticket',
        amount_paid: 0,
        guest_count: qty,
        ticket_type_id: ticketType?.id ?? null,
        ticket_type_name: ticketType?.name ?? null,
      }).select('id').single();

      if (insertError) {
        // Release the seats we reserved, then find out why the insert failed.
        await supabase.rpc('increment_tickets_sold', { p_listing: listing.id, p_n: -qty, p_ticket_type: ticketType?.id ?? undefined });
        const { count } = await supabase
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('listing_id', listingId)
          .eq('customer_id', user.id)
          .eq('booking_type', 'ticket')
          .in('status', ['confirmed', 'completed']);
        if (count && count > 0) {
          return NextResponse.json(
            { error: 'You already have a ticket for this event' },
            { status: 409 }
          );
        }
        return NextResponse.json({ error: 'Could not create booking' }, { status: 500 });
      }

      // One scannable attendee per seat (only for multi-ticket orders).
      if (freeBooking?.id) await createTicketAttendees(createAdminClient(), freeBooking.id, qty);

      return NextResponse.json({
        url: `${process.env.NEXT_PUBLIC_APP_URL}/app/tickets?success=true`,
      });
    }

    // Get creator profile (for Connect account and tier)
    const { data: creator } = await supabase
      .from('profiles')
      .select('stripe_account_id, tier, company_verified_at')
      .eq('id', listing.user_id)
      .single();

    if (!creator?.stripe_account_id) {
      return NextResponse.json(
        { error: 'Creator has not connected their Stripe account' },
        { status: 400 }
      );
    }

    if (!canReceivePayments({ id: listing.user_id, company_verified_at: creator.company_verified_at })) {
      return NextResponse.json({ error: PAYMENTS_BETA_BLOCKED_MESSAGE }, { status: 403 });
    }

    // Calculate pricing — the ticket type's price, else the early-bird price.
    const originalPrice = effectivePrice;
    const discountedPrice = calculateDiscountedPrice(originalPrice, userTier);
    const amountInOre = Math.round(discountedPrice * 100);
    const commissionRate = getCreatorCommissionRate(creator.tier ?? 'gratis');
    const applicationFee = Math.round(amountInOre * commissionRate);

    // Tickster-style service fee (gated off until the flag is set). In BOTH
    // modes the fee is added to the application_fee so it stays with Usha; in
    // "buyer" mode it is ALSO added as a line item so the buyer pays it on top.
    const feeMode = serviceFeeMode(listing.service_fee_mode);
    const serviceFee = computeServiceFeeOre(amountInOre, qty); // total for all N tickets
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: 'sek',
          product_data: { name: ticketType ? `${listing.title} – ${ticketType.name}` : listing.title },
          unit_amount: amountInOre,
        },
        quantity: qty,
      },
    ];
    if (serviceFee > 0 && feeMode === 'buyer') {
      lineItems.push({
        price_data: {
          currency: 'sek',
          product_data: { name: 'Serviceavgift' },
          unit_amount: serviceFee,
        },
        quantity: 1,
      });
    }

    // Create Stripe Checkout session with Connect split
    const stripeLocale = await getStripeLocale();
    const session = await stripe.checkout.sessions.create({
      locale: stripeLocale,
      customer_email: user.email,
      line_items: lineItems,
      mode: 'payment',
      payment_intent_data: {
        application_fee_amount: applicationFee * qty + serviceFee,
        transfer_data: {
          destination: creator.stripe_account_id,
        },
      },
      automatic_tax: { enabled: true },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/app/tickets?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/creators/${listing.user_id}`,
      metadata: {
        type: 'ticket',
        listingId: listing.id,
        userId: user.id,
        creatorId: listing.user_id,
        originalPrice: String(originalPrice),
        discountedPrice: String(discountedPrice),
        serviceFeeOre: String(serviceFee),
        serviceFeeMode: feeMode,
        platformFeeOre: String(applicationFee * qty + serviceFee),
        ticketTypeId: ticketType?.id ?? '',
        ticketTypeName: ticketType?.name ?? '',
        quantity: String(qty),
        eventDate: listing.event_date || '',
        eventTime: listing.event_time || '',
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error('Ticket checkout error:', error);
    const message = error?.message || 'Could not start checkout';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
