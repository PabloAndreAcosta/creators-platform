// Pricing for instructor mini-sessions sold at open events (The Kiz Lab).
// The price for a block of minutes is derived from the instructor's existing
// hourly coaching rate (profiles.coaching_hourly_rate_sek), pro-rated.

// Korta block för en snabb genomgång, och längre pass upp till fyra timmar
// för den som vill ha en hel kväll med en instruktör.
export const MINUTE_OPTIONS = [15, 30, 45, 60, 90, 120, 180, 240] as const;
export type MinuteOption = (typeof MINUTE_OPTIONS)[number];

// Stripe rejects a 0-amount charge; never sell below this.
export const MIN_PRICE_SEK = 1;

export function isMinuteOption(value: number): value is MinuteOption {
  return (MINUTE_OPTIONS as readonly number[]).includes(value);
}

/**
 * Price in whole SEK for `minutes` of an instructor whose hourly rate is
 * `rateSek`, pro rata: 15 min = rate/4, 60 = rate, 90 = rate*1.5 osv.
 * Rounded to the nearest krona.
 */
export function priceForMinutes(rateSek: number, minutes: number): number {
  return Math.round((rateSek * minutes) / 60);
}

/**
 * Längden som människor läser den: under en timme i minuter, annars i timmar
 * (1, 1.5, 2 …). Talet formateras efter språk där det visas.
 */
export function durationParts(minutes: number): { unit: "min" | "h"; value: number } {
  return minutes < 60 ? { unit: "min", value: minutes } : { unit: "h", value: minutes / 60 };
}
