import { describe, it, expect } from 'vitest';
import { getDiscountPercentage, formatDiscount, applyDiscount } from '../discounts';

describe('getDiscountPercentage', () => {
  it('returns 0 for null tier', () => {
    expect(getDiscountPercentage(null)).toBe(0);
  });

  it('returns 0 for gratis tier', () => {
    expect(getDiscountPercentage('gratis')).toBe(0);
  });

  it('returns 10% for guld tier', () => {
    expect(getDiscountPercentage('guld')).toBe(0.10);
  });

  it('returns 20% for premium tier', () => {
    expect(getDiscountPercentage('premium')).toBe(0.20);
  });

  it('returns 0 for invalid tier', () => {
    expect(getDiscountPercentage('invalid')).toBe(0);
  });
});

describe('formatDiscount', () => {
  it('formats 0.20 as "20%"', () => {
    expect(formatDiscount(0.20)).toBe('20%');
  });

  it('formats 0.10 as "10%"', () => {
    expect(formatDiscount(0.10)).toBe('10%');
  });

  it('formats 0.05 as "5%"', () => {
    expect(formatDiscount(0.05)).toBe('5%');
  });

  it('formats 0 as "0%"', () => {
    expect(formatDiscount(0)).toBe('0%');
  });
});

describe('applyDiscount', () => {
  it('applies 20% discount to 300 SEK', () => {
    expect(applyDiscount(300, 0.20)).toBe(240);
  });

  it('applies 10% discount to 300 SEK', () => {
    expect(applyDiscount(300, 0.10)).toBe(270);
  });

  it('applies 5% discount to 300 SEK', () => {
    expect(applyDiscount(300, 0.05)).toBe(285);
  });

  it('applies 0% discount (full price)', () => {
    expect(applyDiscount(300, 0)).toBe(300);
  });

  it('handles non-round amounts with proper rounding', () => {
    expect(applyDiscount(199, 0.20)).toBe(159.2);
  });
});
