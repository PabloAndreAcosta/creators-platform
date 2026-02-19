export type CreatorTier = 'silver' | 'gold' | 'platinum';
export type EventTier = 'a' | 'b' | 'c';

export interface PayoutBreakdown {
  gross: number;
  commission: number;
  net: number;
  commissionRate: number;
}

const COMMISSION_RATES: Record<CreatorTier, number> = {
  silver: 0.20,
  gold: 0.10,
  platinum: 0.05,
};

const DISCOUNT_MATRIX: Record<'gold' | 'platinum', Record<EventTier, number>> = {
  gold: { a: 0.20, b: 0.10, c: 0.05 },
  platinum: { a: 0.30, b: 0.20, c: 0.10 },
};

/**
 * Returns the commission rate for a creator based on their tier.
 * Silver: 20%, Gold: 10%, Platinum: 5%.
 * Defaults to 20% if tier is not recognized.
 */
export function getCreatorCommissionRate(creatorTier: CreatorTier): number {
  return COMMISSION_RATES[creatorTier] ?? 0.20;
}

/**
 * Calculates the payout breakdown for a booking.
 * Returns gross amount, platform commission, net payout to creator, and the rate applied.
 */
export function calculateCreatorPayout(
  bookingAmount: number,
  creatorTier: string
): PayoutBreakdown {
  const rate = COMMISSION_RATES[creatorTier as CreatorTier] ?? 0.20;
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
 * Calculates the discounted price for a user based on their tier and the event's pricing tier.
 * Silver users and unauthenticated users pay full price.
 * Gold and Platinum members receive tiered discounts depending on event tier (a/b/c).
 * Returns the discounted price rounded to 2 decimals.
 */
export function calculateDiscountedPrice(
  originalPrice: number,
  userTier: string | null,
  eventTier: string
): number {
  if (!userTier || userTier === 'silver') return originalPrice;

  const discounts = DISCOUNT_MATRIX[userTier as 'gold' | 'platinum'];
  if (!discounts) return originalPrice;

  const discount = discounts[eventTier as EventTier];
  if (discount === undefined) return originalPrice;

  return Math.round(originalPrice * (1 - discount) * 100) / 100;
}
