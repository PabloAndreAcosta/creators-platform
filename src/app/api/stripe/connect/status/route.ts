import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/client';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/stripe/connect/status
 * Returns the current Stripe Connect status for the authenticated creator.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // stripe_account_id är kolumn-låst för authenticated — egen rad via service-role.
    const { data: profile } = await createAdminClient()
      .from('profiles')
      .select('stripe_account_id')
      .eq('id', user.id)
      .single();

    if (!profile?.stripe_account_id) {
      return NextResponse.json({
        connected: false,
        chargesEnabled: false,
        payoutsEnabled: false,
      });
    }

    const account = await stripe.accounts.retrieve(profile.stripe_account_id);

    // Write what Stripe just told us back onto the profile.
    //
    // The columns are normally kept fresh by the account.updated webhook, but a
    // seller who finished onboarding before that handler existed never got an
    // event — and the onboarding checklist reads the columns, so it went on
    // demanding a step that was already done, with nothing left to click.
    // Since the live account is already in hand here, the page that shows the
    // status is also the page that repairs it.
    const cardPayments = account.capabilities?.card_payments === "active";
    const { error: syncError } = await createAdminClient()
      .from("profiles")
      .update({
        stripe_card_payments_enabled: cardPayments,
        stripe_charges_enabled: !!account.charges_enabled,
        stripe_details_submitted: !!account.details_submitted,
      })
      .eq("id", user.id);
    if (syncError) {
      // Never let a bookkeeping write break the status the caller asked for.
      console.error("connect status sync failed:", syncError.message);
    }

    return NextResponse.json({
      connected: true,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      cardPaymentsEnabled: cardPayments,
      accountId: account.id,
    });
  } catch (error) {
    console.error('Connect status error:', error);
    return NextResponse.json(
      { error: 'Could not fetch account status' },
      { status: 500 }
    );
  }
}
