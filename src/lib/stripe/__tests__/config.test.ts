import { describe, it, expect } from 'vitest';
import { PLANS, GRATIS_PLAN, getPlanList } from '../config';

describe('PLANS', () => {
  it('has 6 plans total', () => {
    expect(Object.keys(PLANS)).toHaveLength(6);
  });

  it('has 2 plans per role', () => {
    const roles = Object.values(PLANS).map((p) => p.role);
    expect(roles.filter((r) => r === 'publik')).toHaveLength(2);
    expect(roles.filter((r) => r === 'kreator')).toHaveLength(2);
    expect(roles.filter((r) => r === 'upplevelse')).toHaveLength(2);
  });

  it('all plans have SEK currency and monthly interval', () => {
    for (const plan of Object.values(PLANS)) {
      expect(plan.currency).toBe('SEK');
      expect(plan.interval).toBe('month');
    }
  });

  it('publik plans are cheaper than kreator/upplevelse plans', () => {
    expect(PLANS.publik_guld.price).toBeLessThan(PLANS.kreator_guld.price);
    expect(PLANS.publik_premium.price).toBeLessThan(PLANS.kreator_premium.price);
  });

  it('guld plans are cheaper than premium plans within same role', () => {
    expect(PLANS.publik_guld.price).toBeLessThan(PLANS.publik_premium.price);
    expect(PLANS.kreator_guld.price).toBeLessThan(PLANS.kreator_premium.price);
    expect(PLANS.upplevelse_guld.price).toBeLessThan(PLANS.upplevelse_premium.price);
  });
});

describe('GRATIS_PLAN', () => {
  it('has price 0', () => {
    expect(GRATIS_PLAN.price).toBe(0);
  });

  it('has tier gratis', () => {
    expect(GRATIS_PLAN.tier).toBe('gratis');
  });
});

describe('getPlanList', () => {
  it('returns all 6 plans without filter', () => {
    expect(getPlanList()).toHaveLength(6);
  });

  it('returns 2 plans for publik role', () => {
    const plans = getPlanList('publik');
    expect(plans).toHaveLength(2);
    expect(plans.every((p) => p.role === 'publik')).toBe(true);
  });

  it('returns 2 plans for kreator role', () => {
    const plans = getPlanList('kreator');
    expect(plans).toHaveLength(2);
    expect(plans.every((p) => p.role === 'kreator')).toBe(true);
  });

  it('returns 2 plans for upplevelse role', () => {
    const plans = getPlanList('upplevelse');
    expect(plans).toHaveLength(2);
    expect(plans.every((p) => p.role === 'upplevelse')).toBe(true);
  });

  it('plan objects include key, name, price, features', () => {
    const plans = getPlanList('kreator');
    for (const plan of plans) {
      expect(plan).toHaveProperty('key');
      expect(plan).toHaveProperty('name');
      expect(plan).toHaveProperty('price');
      expect(plan).toHaveProperty('features');
      expect(plan.features.length).toBeGreaterThan(0);
    }
  });
});
