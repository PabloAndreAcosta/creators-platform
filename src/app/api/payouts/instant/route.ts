import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createInstantPayout } from '@/lib/stripe/payouts';

export async function POST(req: NextRequest) {
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
        { error: 'Ogiltigt belopp' },
        { status: 400 }
      );
    }

    const result = await createInstantPayout(user.id, amount);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Instant payout error:', error);
    return NextResponse.json(
      { error: 'Kunde inte genomföra utbetalning' },
      { status: 500 }
    );
  }
}
