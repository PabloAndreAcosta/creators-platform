import { describe, it, expect } from 'vitest';
import { PLANS, GRATIS_PLAN, getPlanList } from '../config';

describe('PLANS', () => {
  it('has 6 plans total', () => {
    expect(Object.keys(PLANS)).toHaveLength(6);
  });

  it('has 2 plans per role', () => {
    const roles = Object.values(PLANS).map((p) => p.role);
    expect(roles.filter((r) => r === 'customer')).toHaveLength(2);
    expect(roles.filter((r) => r === 'creator')).toHaveLength(2);
    expect(roles.filter((r) => r === 'venue')).toHaveLength(2);
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
  });

  it('venue-nivåerna är avvecklade och kostar noll', () => {
    // En lokal är en avtalspart, inte en abonnent. Nycklarna ligger kvar så
    // att befintliga prenumerationer och webhooken kan läsa sitt plan-id.
    expect(PLANS.upplevelse_guld.retired).toBe(true);
    expect(PLANS.upplevelse_premium.retired).toBe(true);
    expect(PLANS.upplevelse_guld.price).toBe(0);
    expect(PLANS.upplevelse_premium.price).toBe(0);
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
  it('returnerar bara nivåer som går att teckna', () => {
    // Sex plan-nycklar finns, men de två avvecklade venue-nivåerna ska inte
    // dyka upp i någon prislista.
    const plans = getPlanList();
    expect(plans).toHaveLength(4);
    expect(plans.some((p) => p.role === 'venue')).toBe(false);
  });

  it('returns 2 plans for publik role', () => {
    const plans = getPlanList('customer');
    expect(plans).toHaveLength(2);
    expect(plans.every((p) => p.role === 'customer')).toBe(true);
  });

  it('returns 2 plans for kreator role', () => {
    const plans = getPlanList('creator');
    expect(plans).toHaveLength(2);
    expect(plans.every((p) => p.role === 'creator')).toBe(true);
  });

  it('returnerar inga nivåer för venue — de är avvecklade', () => {
    expect(getPlanList('venue')).toHaveLength(0);
  });

  it('plan objects include key, name, price, features', () => {
    const plans = getPlanList('creator');
    for (const plan of plans) {
      expect(plan).toHaveProperty('key');
      expect(plan).toHaveProperty('name');
      expect(plan).toHaveProperty('price');
      expect(plan).toHaveProperty('features');
      expect(plan.features.length).toBeGreaterThan(0);
    }
  });
});
