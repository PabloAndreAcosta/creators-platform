import { describe, it, expect } from 'vitest';
import {
  priceForMinutes,
  isMinuteOption,
  MINUTE_OPTIONS,
  MIN_PRICE_SEK,
} from '../minute-pricing';

describe('priceForMinutes', () => {
  it('pro-rates a round hourly rate across the four blocks', () => {
    expect(priceForMinutes(1000, 15)).toBe(250);
    expect(priceForMinutes(1000, 30)).toBe(500);
    expect(priceForMinutes(1000, 45)).toBe(750);
    expect(priceForMinutes(1000, 60)).toBe(1000);
  });

  it('rounds to whole SEK', () => {
    // 99/4 = 24.75 -> 25, 99*3/4 = 74.25 -> 74
    expect(priceForMinutes(99, 15)).toBe(25);
    expect(priceForMinutes(99, 30)).toBe(50); // 49.5 -> 50
    expect(priceForMinutes(99, 45)).toBe(74);
    expect(priceForMinutes(99, 60)).toBe(99);
  });

  it('handles a typical 350 SEK rate', () => {
    expect(priceForMinutes(350, 15)).toBe(88); // 87.5 -> 88
    expect(priceForMinutes(350, 30)).toBe(175);
    expect(priceForMinutes(350, 45)).toBe(263); // 262.5 -> 263
    expect(priceForMinutes(350, 60)).toBe(350);
  });

  it('can round a tiny rate down toward zero (guarded by MIN_PRICE_SEK elsewhere)', () => {
    expect(priceForMinutes(2, 15)).toBe(1); // 0.5 -> 1 (banker-free round)
    expect(priceForMinutes(1, 15)).toBe(0); // 0.25 -> 0, caller must guard
    expect(MIN_PRICE_SEK).toBe(1);
  });
});

describe('isMinuteOption', () => {
  it('accepts the four valid blocks', () => {
    for (const m of MINUTE_OPTIONS) expect(isMinuteOption(m)).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isMinuteOption(0)).toBe(false);
    expect(isMinuteOption(10)).toBe(false);
    expect(isMinuteOption(75)).toBe(false);
  });
});
