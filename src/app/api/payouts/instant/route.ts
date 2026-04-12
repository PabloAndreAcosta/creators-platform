import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createInstantPayout } from '@/lib/stripe/payouts';

export async function POST(req: NextRequest) {
  // Rate limit: 3 instant payouts per minute
  const { rateLimit, getRateLimitKey } = await import('@/lib/rate-limit');
  const rl = rateLimit(getRateLimitKey(req, 'instant-payout'), 3, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { amount } = await req.json();

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      );
    }

    // Verify creator has sufficient balance from completed bookings
    const { data: completedBookings } = await supabase
      .from('bookings')
      .select('amount_paid')
      .eq('creator_id', user.id)
      .eq('status', 'completed');

    const { data: existingPayouts } = await supabase
      .from('payouts')
      .select('amount_gross')
      .eq('creator_id', user.id)
      .in('status', ['pending', 'in_transit', 'paid']);

    const totalEarned = (completedBookings ?? []).reduce(
      (sum, b) => sum + (b.amount_paid ? b.amount_paid / 100 : 0), 0
    );
    const totalPaidOut = (existingPayouts ?? []).reduce(
      (sum, p) => sum + (p.amount_gross || 0), 0
    );
    const availableBalance = totalEarned - totalPaidOut;

    if (amount > availableBalance) {
      return NextResponse.json(
        { error: `Insufficient balance. Available: ${availableBalance.toFixed(2)} SEK` },
        { status: 400 }
      );
    }

    const result = await createInstantPayout(user.id, amount);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'An error occurred. Please try again.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Instant payout error:', error);
    return NextResponse.json(
      { error: 'An error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
