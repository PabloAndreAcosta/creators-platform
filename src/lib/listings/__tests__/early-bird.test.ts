import { describe, it, expect } from 'vitest';
import { isGoldExclusive, filterByGoldExclusivity, getHoursUntilPublic } from '../early-bird';

describe('isGoldExclusive', () => {
  it('returns false when releaseToGoldAt is null', () => {
    expect(isGoldExclusive(null)).toBe(false);
  });

  it('returns true when release date is in the future', () => {
    const future = new Date(Date.now() + 3600_000);
    expect(isGoldExclusive(future)).toBe(true);
  });

  it('returns false when release date is in the past', () => {
    const past = new Date(Date.now() - 3600_000);
    expect(isGoldExclusive(past)).toBe(false);
  });

  it('uses custom now parameter', () => {
    const release = new Date('2026-06-01T12:00:00Z');
    const before = new Date('2026-06-01T11:00:00Z');
    const after = new Date('2026-06-01T13:00:00Z');
    expect(isGoldExclusive(release, before)).toBe(true);
    expect(isGoldExclusive(release, after)).toBe(false);
  });
});

describe('filterByGoldExclusivity', () => {
  const futureDate = new Date(Date.now() + 86400_000).toISOString();
  const pastDate = new Date(Date.now() - 86400_000).toISOString();

  const events = [
    { id: '1', release_to_gold_at: null },
    { id: '2', release_to_gold_at: futureDate },
    { id: '3', release_to_gold_at: pastDate },
  ];

  it('shows all events for guld users', () => {
    expect(filterByGoldExclusivity(events, 'guld')).toHaveLength(3);
  });

  it('shows all events for premium users', () => {
    expect(filterByGoldExclusivity(events, 'premium')).toHaveLength(3);
  });

  it('hides gold-exclusive events for gratis users', () => {
    const result = filterByGoldExclusivity(events, 'gratis');
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.id)).toEqual(['1', '3']);
  });

  it('hides gold-exclusive events for null tier', () => {
    const result = filterByGoldExclusivity(events, null);
    expect(result).toHaveLength(2);
  });
});

describe('getHoursUntilPublic', () => {
  it('returns 0 for null release date', () => {
    expect(getHoursUntilPublic(null)).toBe(0);
  });

  it('returns 0 for past release date', () => {
    const past = new Date(Date.now() - 3600_000);
    expect(getHoursUntilPublic(past)).toBe(0);
  });

  it('returns positive hours for future release date', () => {
    const future = new Date(Date.now() + 7200_000); // 2 hours from now
    const hours = getHoursUntilPublic(future);
    expect(hours).toBeGreaterThanOrEqual(1);
    expect(hours).toBeLessThanOrEqual(2);
  });
});
