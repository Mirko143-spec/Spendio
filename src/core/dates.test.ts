import { describe, expect, it } from 'vitest';
import { daysBetween, isoDate } from './dates.ts';

describe('isoDate', () => {
  it('builds zero-padded ISO dates', () => {
    expect(isoDate(2026, 3, 5)).toBe('2026-03-05');
  });

  it('rejects dates that do not exist', () => {
    expect(isoDate(2026, 2, 29)).toBeUndefined();
    expect(isoDate(2026, 13, 1)).toBeUndefined();
    expect(isoDate(2026, 4, 31)).toBeUndefined();
    expect(isoDate(2028, 2, 29)).toBe('2028-02-29');
  });
});

describe('daysBetween', () => {
  it('counts whole days, across months and years', () => {
    expect(daysBetween('2026-10-31', '2026-11-01')).toBe(1);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysBetween('2026-11-25', '2026-11-24')).toBe(-1);
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2); // across the EU DST switch
  });
});
