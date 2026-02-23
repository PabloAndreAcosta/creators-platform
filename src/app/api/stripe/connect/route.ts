import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/client';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/stripe/connect
 * Creates a Stripe Connect Express account for the authenticated creator
 * and returns the onboarding URL.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if creator already has a connected account
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_account_id, email, full_name')
      .eq('id', user.id)
      .single();

    if (profile?.stripe_account_id) {
      // Account exists — create new account link for re-onboarding
      const accountLink = await stripe.accountLinks.create({
        account: profile.stripe_account_id,
        refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?connect=refresh`,
        return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?connect=success`,
        type: 'account_onboarding',
      });

      return NextResponse.json({ url: accountLink.url });
    }

    // Create new Express account
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'SE',
      email: user.email,
      capabilities: {
        transfers: { requested: true },
      },
      business_type: 'individual',
      metadata: {
        userId: user.id,
      },
    });

    // Save the account ID to the profile
    const admin = createAdminClient();
    const { error: updateError } = await admin
      .from('profiles')
      .update({ stripe_account_id: account.id })
      .eq('id', user.id);

    if (updateError) {
      console.error('Failed to save Stripe account ID:', updateError);
      return NextResponse.json(
        { error: 'Kunde inte spara kontoinformation' },
        { status: 500 }
      );
    }

    // Create onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?connect=refresh`,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?connect=success`,
      type: 'account_onboarding',
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (error) {
    console.error('Stripe Connect error:', error);
    return NextResponse.json(
      { error: 'Kunde inte starta Stripe-koppling' },
      { status: 500 }
    );
  }
}
