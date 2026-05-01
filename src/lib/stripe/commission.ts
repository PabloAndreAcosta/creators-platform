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

// Reduced commission rates for taxi_dancer creators (Fas 5 perk).
// Independent of subscription tier — taxi_dancer subcategory grants
// a flat preferential rate that beats the gratis tier on day one and
// stays competitive even at premium.
export const TAXI_DANCER_COMMISSION_RATES: Record<MemberTier, number> = {
  gratis: 0.08,
  guld: 0.05,
  premium: 0.03,
};

export const DISCOUNT_RATES: Record<'guld' | 'premium', number> = {
  guld: 0.10,
  premium: 0.20,
};

/**
 * Returns the commission rate for a creator based on their tier and
 * (optionally) their creator_subcategory. Taxi dancers get reduced
 * rates as a Fas 5 special offer.
 *
 * Standard: gratis 15%, guld 8%, premium 3%
 * Taxi dancer: gratis 8%, guld 5%, premium 3%
 */
export function getCreatorCommissionRate(
  tier: string,
  creatorSubcategory?: string | null
): number {
  if (creatorSubcategory === "taxi_dancer") {
    return TAXI_DANCER_COMMISSION_RATES[tier as MemberTier] ?? 0.08;
  }
  return COMMISSION_RATES[tier as MemberTier] ?? 0.15;
}

/**
 * Calculates the payout breakdown for a booking.
 * Returns gross amount, platform commission, net payout to creator, and the rate applied.
 */
export function calculateCreatorPayout(
  bookingAmount: number,
  creatorTier: string,
  creatorSubcategory?: string | null
): PayoutBreakdown {
  const rate = getCreatorCommissionRate(creatorTier, creatorSubcategory);
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
