import { NextRequest, NextResponse } from 'next/server';
import { weeklyPayoutBatch } from '@/lib/stripe/payouts';

function verifyAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  return !!cronSecret && authHeader === `Bearer ${cronSecret}`;
}

// GET — triggered by Vercel Cron
export async function GET(req: NextRequest) {
  if (!verifyAuth(req)) {
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

// POST — manual trigger
export async function POST(req: NextRequest) {
  if (!verifyAuth(req)) {
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
