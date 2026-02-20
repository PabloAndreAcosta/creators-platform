import { stripe } from '@/lib/stripe/client';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCreatorCommissionRate, type CreatorTier } from '@/lib/stripe/commission';

interface BatchResult {
  processed: number;
  total: number;
  errors: string[];
}

interface InstantPayoutResult {
  success: boolean;
  error?: string;
}

/**
 * Returns the Stripe Connect account ID for a creator.
 * Throws if the creator has no connected Stripe account.
 */
async function getCreatorStripeAccount(creatorId: string): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('stripe_account_id')
    .eq('id', creatorId)
    .single();

  if (error || !data?.stripe_account_id) {
    throw new Error(`Creator ${creatorId} has no connected Stripe account`);
  }

  return data.stripe_account_id;
}

/**
 * Processes weekly batch payouts for all creators with completed bookings
 * from the past 7 days. Groups bookings by creator, calculates commission
 * based on tier, creates Stripe payouts, and records in the payouts table.
 *
 * Individual creator errors do not fail the entire batch.
 */
export async function weeklyPayoutBatch(): Promise<BatchResult> {
  const supabase = createAdminClient();
  const errors: string[] = [];
  let processed = 0;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Get completed bookings from the past 7 days with listing price
  const { data: bookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('id, creator_id, listing_id, listings(price)')
    .eq('status', 'completed')
    .gte('updated_at', sevenDaysAgo.toISOString());

  if (bookingsError) {
    console.error('Failed to fetch bookings:', bookingsError);
    return { processed: 0, total: 0, errors: [bookingsError.message] };
  }

  if (!bookings || bookings.length === 0) {
    return { processed: 0, total: 0, errors: [] };
  }

  // Group bookings by creator
  const creatorTotals = new Map<string, number>();
  for (const booking of bookings) {
    const price = (booking.listings as unknown as { price: number })?.price ?? 0;
    const current = creatorTotals.get(booking.creator_id) ?? 0;
    creatorTotals.set(booking.creator_id, current + price);
  }

  const total = creatorTotals.size;

  for (const [creatorId, grossAmount] of Array.from(creatorTotals)) {
    try {
      // Get creator tier
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('tier, email, full_name, stripe_account_id')
        .eq('id', creatorId)
        .single();

      if (profileError || !profile) {
        errors.push(`Creator ${creatorId}: profile not found`);
        continue;
      }

      if (!profile.stripe_account_id) {
        errors.push(`Creator ${creatorId}: no Stripe account connected`);
        continue;
      }

      // Calculate commission
      const commissionRate = getCreatorCommissionRate(
        (profile.tier as CreatorTier) ?? 'silver'
      );
      const commissionAmount = Math.round(grossAmount * commissionRate * 100) / 100;
      const netAmount = Math.round((grossAmount - commissionAmount) * 100) / 100;

      // Create Stripe payout (amount in öre/cents)
      const stripePayout = await stripe.payouts.create(
        {
          amount: Math.round(netAmount * 100),
          currency: 'sek',
          method: 'standard',
        },
        { stripeAccount: profile.stripe_account_id }
      );

      // Record in payouts table
      const { error: insertError } = await supabase.from('payouts').insert({
        creator_id: creatorId,
        amount_gross: grossAmount,
        amount_commission: commissionAmount,
        amount_net: netAmount,
        payout_type: 'batch',
        stripe_payout_id: stripePayout.id,
        status: 'pending',
      });

      if (insertError) {
        console.error(`Failed to record payout for ${creatorId}:`, insertError);
        errors.push(`Creator ${creatorId}: payout created but failed to record`);
        continue;
      }

      processed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Payout failed for creator ${creatorId}:`, message);
      errors.push(`Creator ${creatorId}: ${message}`);
    }
  }

  return { processed, total, errors };
}

/**
 * Creates an instant payout for a creator. The first instant payout each
 * month is free; subsequent ones incur a 1% fee.
 */
export async function createInstantPayout(
  creatorId: string,
  amount: number
): Promise<InstantPayoutResult> {
  const supabase = createAdminClient();

  try {
    // Get creator profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tier, email, full_name, stripe_account_id')
      .eq('id', creatorId)
      .single();

    if (profileError || !profile) {
      return { success: false, error: 'Creator profile not found' };
    }

    if (!profile.stripe_account_id) {
      return { success: false, error: 'No Stripe account connected' };
    }

    // Check how many instant payouts this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count, error: countError } = await supabase
      .from('payouts')
      .select('id', { count: 'exact', head: true })
      .eq('creator_id', creatorId)
      .eq('payout_type', 'instant')
      .gte('created_at', startOfMonth.toISOString());

    if (countError) {
      return { success: false, error: 'Failed to check payout history' };
    }

    // Apply 1% fee if not the first instant payout this month
    const fee = (count ?? 0) >= 1 ? Math.round(amount * 0.01 * 100) / 100 : 0;
    const payoutAmount = Math.round((amount - fee) * 100) / 100;

    // Calculate commission
    const commissionRate = getCreatorCommissionRate(
      (profile.tier as CreatorTier) ?? 'silver'
    );
    const commissionAmount = Math.round(payoutAmount * commissionRate * 100) / 100;
    const netAmount = Math.round((payoutAmount - commissionAmount) * 100) / 100;

    // Create Stripe instant payout (amount in öre/cents)
    const stripePayout = await stripe.payouts.create(
      {
        amount: Math.round(netAmount * 100),
        currency: 'sek',
        method: 'instant',
      },
      { stripeAccount: profile.stripe_account_id }
    );

    // Record in payouts table
    const { error: insertError } = await supabase.from('payouts').insert({
      creator_id: creatorId,
      amount_gross: payoutAmount,
      amount_commission: commissionAmount,
      amount_net: netAmount,
      payout_type: 'instant',
      stripe_payout_id: stripePayout.id,
      status: 'pending',
    });

    if (insertError) {
      console.error('Failed to record instant payout:', insertError);
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Instant payout failed for creator ${creatorId}:`, message);
    return { success: false, error: message };
  }
}
