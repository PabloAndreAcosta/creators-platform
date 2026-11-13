import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getCreatorCommissionRate,
  calculateCreatorPayout,
  calculateDiscountedPrice,
  platformCommissionOre,
  effectiveCommissionRate,
  commissionLabel,
  COMMISSION_RATES,
  PLATFORM_COMMISSION,
} from '../commission';

describe('platformCommissionOre (3,5 % + 3,50 kr per biljett sedan 2026-11-13)', () => {
  it('räknar procent plus fast del per biljett: 130 kr → 4,55 + 3,50 = 8,05 kr', () => {
    expect(platformCommissionOre(13000, 1)).toBe(805);
  });

  it('tar den fasta delen per biljett i ett flerköp: 3 × 130 kr → 3 × 8,05', () => {
    expect(platformCommissionOre(13000, 3)).toBe(2415);
  });

  it('är 0 på en gratisbiljett — gratis event kostar inget', () => {
    expect(platformCommissionOre(0, 1)).toBe(0);
    expect(platformCommissionOre(0, 4)).toBe(0);
  });

  it('ligger under Billetto på en kurs för 450 kr (19,25 kr mot deras ca 26)', () => {
    expect(platformCommissionOre(45000, 1)).toBe(1925);
  });

  it('går aldrig back mot Stripes kortkostnad (1,5 % + 1,80 kr), inte ens på 50 kr', () => {
    for (const ore of [5000, 7000, 10000, 12500, 20000, 45000, 100000]) {
      const stripe = ore * 0.015 + 180;
      expect(platformCommissionOre(ore, 1)).toBeGreaterThan(stripe);
    }
  });
});

describe('effectiveCommissionRate', () => {
  it('är högre på billiga biljetter och lägre på dyra', () => {
    expect(effectiveCommissionRate(12500)).toBeCloseTo(0.063, 3);
    expect(effectiveCommissionRate(45000)).toBeCloseTo(0.0428, 3);
  });
  it('är 0 på gratis', () => {
    expect(effectiveCommissionRate(0)).toBe(0);
  });
});

describe('commissionLabel', () => {
  it('skriver satsen på svenskt vis och matchar konstanterna', () => {
    expect(commissionLabel()).toBe('3,5 % + 3,50 kr');
    expect(PLATFORM_COMMISSION.rate).toBe(0.035);
    expect(PLATFORM_COMMISSION.fixedOre).toBe(350);
  });
});

describe('getCreatorCommissionRate (en nivå: samma procentdel för alla)', () => {
  it('ger procentdelen för alla gamla nivåvärden', () => {
    for (const tier of ['gratis', 'guld', 'premium', 'unknown']) {
      expect(getCreatorCommissionRate(tier)).toBe(PLATFORM_COMMISSION.rate);
      expect(getCreatorCommissionRate(tier, 'taxi_dancer')).toBe(PLATFORM_COMMISSION.rate);
    }
    expect(COMMISSION_RATES.gratis).toBe(COMMISSION_RATES.guld);
    expect(COMMISSION_RATES.gratis).toBe(COMMISSION_RATES.premium);
  });
});

describe('calculateCreatorPayout (procentdelen, för gamla anrop)', () => {
  it('räknar netto = brutto − provision', () => {
    const result = calculateCreatorPayout(1000, 'gratis');
    expect(result.gross).toBe(1000);
    expect(result.commission).toBe(35);
    expect(result.net).toBe(965);
    expect(result.commissionRate).toBe(0.035);
  });

  it('samma för alla nivåvärden', () => {
    for (const tier of ['gratis', 'guld', 'premium', 'nonexistent'] as const) {
      const p = calculateCreatorPayout(1000, tier);
      expect(p.net).toBe(p.gross - p.commission);
      expect(p.commissionRate).toBe(0.035);
    }
  });
});

describe('calculateDiscountedPrice', () => {
  // Medlemsrabatterna är avstängda via env och nivåerna borta; funktionen
  // ska ge fullt pris så länge flaggan inte är satt.
  const prev = process.env.NEXT_PUBLIC_DISCOUNTS_ENABLED;
  beforeEach(() => {
    vi.unstubAllEnvs();
  });
  afterEach(() => {
    process.env.NEXT_PUBLIC_DISCOUNTS_ENABLED = prev;
  });

  it('ger fullt pris när flaggan är av', () => {
    delete process.env.NEXT_PUBLIC_DISCOUNTS_ENABLED;
    expect(calculateDiscountedPrice(1000, 'premium')).toBe(1000);
    expect(calculateDiscountedPrice(1000, 'gratis')).toBe(1000);
    expect(calculateDiscountedPrice(1000, null)).toBe(1000);
  });
});
