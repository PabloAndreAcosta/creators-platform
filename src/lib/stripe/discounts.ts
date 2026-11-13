/**
 * Returns the flat discount percentage (as a decimal 0–0.20) based on
 * the user's membership tier.
 * Gratis users receive no discount. Guld: 10%, Premium: 20%.
 */
export function getDiscountPercentage(
  userTier: string | null
): number {
  // Inga medlemsrabatter sedan en nivå (2026-11-13).
  void userTier;
  return 0;
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
