import { NextResponse } from 'next/server';

/**
 * DEPRECATED: Creator tier subscriptions are now handled via the unified
 * checkout at /api/stripe/checkout with planKey format (e.g. 'kreator_guld').
 */
export async function POST() {
  return NextResponse.json(
    {
      error: 'Denna endpoint är borttagen. Använd /api/stripe/checkout med planKey (t.ex. kreator_guld).',
      redirect: '/api/stripe/checkout',
    },
    { status: 410 }
  );
}
