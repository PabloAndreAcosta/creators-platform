import { describe, it, expect } from 'vitest';
import {
  getCreatorCommissionRate,
  calculateCreatorPayout,
  calculateDiscountedPrice,
  COMMISSION_RATES,
} from '../commission';

describe('getCreatorCommissionRate', () => {
  it('returns 15% for gratis tier', () => {
    expect(getCreatorCommissionRate('gratis')).toBe(0.15);
  });

  it('returns 8% for guld tier', () => {
    expect(getCreatorCommissionRate('guld')).toBe(0.08);
  });

  it('returns 3% for premium tier', () => {
    expect(getCreatorCommissionRate('premium')).toBe(0.03);
  });

  it('defaults to 15% for unknown tier', () => {
    expect(getCreatorCommissionRate('unknown')).toBe(0.15);
  });
});

describe('calculateCreatorPayout', () => {
  it('calculates correctly for gratis (1000 SEK)', () => {
    const result = calculateCreatorPayout(1000, 'gratis');
    expect(result.gross).toBe(1000);
    expect(result.commission).toBe(150);
    expect(result.net).toBe(850);
    expect(result.commissionRate).toBe(0.15);
  });

  it('calculates correctly for guld (1000 SEK)', () => {
    const result = calculateCreatorPayout(1000, 'guld');
    expect(result.gross).toBe(1000);
    expect(result.commission).toBe(80);
    expect(result.net).toBe(920);
    expect(result.commissionRate).toBe(0.08);
  });

  it('calculates correctly for premium (1000 SEK)', () => {
    const result = calculateCreatorPayout(1000, 'premium');
    expect(result.gross).toBe(1000);
    expect(result.commission).toBe(30);
    expect(result.net).toBe(970);
    expect(result.commissionRate).toBe(0.03);
  });

  it('ensures net = gross - commission for all tiers', () => {
    for (const tier of ['gratis', 'guld', 'premium'] as const) {
      const p = calculateCreatorPayout(1000, tier);
      expect(p.net).toBe(p.gross - p.commission);
    }
  });

  it('handles small amounts with proper rounding', () => {
    const result = calculateCreatorPayout(99.5, 'guld');
    expect(result.commission).toBe(7.96);
    expect(result.net).toBe(91.54);
  });

  it('defaults unknown tiers to gratis commission', () => {
    const result = calculateCreatorPayout(1000, 'nonexistent');
    expect(result.commissionRate).toBe(0.15);
    expect(result.net).toBe(850);
  });
});

describe('calculateDiscountedPrice', () => {
  it('returns full price for gratis users', () => {
    expect(calculateDiscountedPrice(300, 'gratis')).toBe(300);
  });

  it('returns full price for null tier', () => {
    expect(calculateDiscountedPrice(300, null)).toBe(300);
  });

  it('applies 10% discount for guld users', () => {
    expect(calculateDiscountedPrice(300, 'guld')).toBe(270);
  });

  it('applies 20% discount for premium users', () => {
    expect(calculateDiscountedPrice(300, 'premium')).toBe(240);
  });

  it('handles zero price', () => {
    expect(calculateDiscountedPrice(0, 'guld')).toBe(0);
  });
});
