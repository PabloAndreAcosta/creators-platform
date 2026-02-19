import type { EventTier } from '@/lib/stripe/commission';

const discountMap: Record<string, Record<EventTier, number>> = {
  gold: { a: 0.20, b: 0.10, c: 0.05 },
  platinum: { a: 0.30, b: 0.20, c: 0.10 },
};

/**
 * Returns the discount percentage (as a decimal 0–0.30) based on
 * the user's subscription tier and the event's pricing tier.
 * Silver users and unauthenticated users receive no discount.
 */
export function getDiscountPercentage(
  userTier: string | null,
  eventTier: string
): number {
  if (!userTier) return 0;
  return discountMap[userTier]?.[eventTier as EventTier] ?? 0;
}

/**
 * Formats a decimal discount value as a percentage string.
 * Example: 0.20 → "20%"
 */
export function formatDiscount(percent: number): string {
  return `${Math.round(percent * 100)}%`;
}

/**
 * Applies a discount to a price and returns the result rounded to 2 decimals.
 */
export function applyDiscount(price: number, discountPercent: number): number {
  return Math.round(price * (1 - discountPercent) * 100) / 100;
}
