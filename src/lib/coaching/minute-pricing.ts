// Pricing for instructor mini-sessions sold at open events (The Kiz Lab).
// The price for a block of minutes is derived from the instructor's existing
// hourly coaching rate (profiles.coaching_hourly_rate_sek), pro-rated.

export const MINUTE_OPTIONS = [15, 30, 45, 60] as const;
export type MinuteOption = (typeof MINUTE_OPTIONS)[number];

// Stripe rejects a 0-amount charge; never sell below this.
export const MIN_PRICE_SEK = 1;

export function isMinuteOption(value: number): value is MinuteOption {
  return (MINUTE_OPTIONS as readonly number[]).includes(value);
}

/**
 * Price in whole SEK for `minutes` of an instructor whose hourly rate is
 * `rateSek`. 15 min = rate/4, 30 = rate/2, 45 = rate*3/4, 60 = rate.
 * Rounded to the nearest krona.
 */
export function priceForMinutes(rateSek: number, minutes: number): number {
  return Math.round((rateSek * minutes) / 60);
}
