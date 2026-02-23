import { NextRequest, NextResponse } from 'next/server';
import { weeklyPayoutBatch } from '@/lib/stripe/payouts';

export async function POST(req: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await weeklyPayoutBatch();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Batch payout error:', error);
    return NextResponse.json(
      { error: 'Batch payout failed' },
      { status: 500 }
    );
  }
}
