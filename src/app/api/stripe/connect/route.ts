import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/client';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { stripeAccountCountry } from '@/lib/stripe/account-country';

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
      // Account exists — request card_payments (needed for on_behalf_of / merchant
      // of record) so the re-onboarding link collects the extra KYC, then send the
      // organizer through onboarding again.
      await stripe.accounts.update(profile.stripe_account_id, {
        capabilities: {
          transfers: { requested: true },
          card_payments: { requested: true },
        },
      });
      const accountLink = await stripe.accountLinks.create({
        account: profile.stripe_account_id,
        refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?connect=refresh`,
        return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?connect=success`,
        type: 'account_onboarding',
      });

      return NextResponse.json({ url: accountLink.url });
    }

    // Bolagsuppgifterna är kolumn-låsta för authenticated – läs via service-role
    // på den inloggades eget id.
    const { data: company } = await createAdminClient()
      .from('profiles')
      .select('org_number, company_verified_at')
      .eq('id', user.id)
      .maybeSingle();
    const country = stripeAccountCountry(company?.org_number, !!company?.company_verified_at);

    // Create new Express account – i kreatörens land (svenskt som förut, annars
    // det EU-land där bolaget är verifierat).
    const account = await stripe.accounts.create({
      type: 'express',
      country,
      email: user.email,
      capabilities: {
        transfers: { requested: true },
        // card_payments is required to make the organizer merchant of record
        // (on_behalf_of) for third-party ticket sales.
        card_payments: { requested: true },
      },
      // Svenska kreatörer säljer som privatperson eller enskild firma som förut.
      // Utländska har alltid ett verifierat bolag; Stripe frågar själv om formen.
      ...(country === 'SE' ? { business_type: 'individual' as const } : {}),
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
        { error: 'Could not save account information' },
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
      { error: "An error occurred. Please try again." },
      { status: 500 }
    );
  }
}
