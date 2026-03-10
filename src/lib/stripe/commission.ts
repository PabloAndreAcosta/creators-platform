export type MemberTier = 'gratis' | 'guld' | 'premium';

export interface PayoutBreakdown {
  gross: number;
  commission: number;
  net: number;
  commissionRate: number;
}

export const COMMISSION_RATES: Record<MemberTier, number> = {
  gratis: 0.15,
  guld: 0.08,
  premium: 0.03,
};

export const DISCOUNT_RATES: Record<'guld' | 'premium', number> = {
  guld: 0.10,
  premium: 0.20,
};

/**
 * Returns the commission rate for a creator based on their tier.
 * Gratis: 15%, Guld: 8%, Premium: 3%.
 */
export function getCreatorCommissionRate(tier: string): number {
  return COMMISSION_RATES[tier as MemberTier] ?? 0.15;
}

/**
 * Calculates the payout breakdown for a booking.
 * Returns gross amount, platform commission, net payout to creator, and the rate applied.
 */
export function calculateCreatorPayout(
  bookingAmount: number,
  creatorTier: string
): PayoutBreakdown {
  const rate = COMMISSION_RATES[creatorTier as MemberTier] ?? 0.15;
  const commission = Math.round(bookingAmount * rate * 100) / 100;
  const net = Math.round((bookingAmount - commission) * 100) / 100;

  return {
    gross: bookingAmount,
    commission,
    net,
    commissionRate: rate,
  };
}

/**
 * Calculates the discounted price for a user based on their membership tier.
 * Gratis users pay full price.
 * Guld members get 10% discount, Premium members get 20% discount.
 */
export function calculateDiscountedPrice(
  originalPrice: number,
  userTier: string | null
): number {
  if (!userTier || userTier === 'gratis') return originalPrice;

  const discount = DISCOUNT_RATES[userTier as 'guld' | 'premium'];
  if (discount === undefined) return originalPrice;

  return Math.round(originalPrice * (1 - discount) * 100) / 100;
}
