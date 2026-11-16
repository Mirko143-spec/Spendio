import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, isoDate, weekday } from './dates.ts';

describe('addDays', () => {
  it('shifts across month, year and leap-day boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30'); // across the EU DST switch
  });
});

describe('weekday', () => {
  it('returns 0 for Sunday through 6 for Saturday', () => {
    expect(weekday('2026-10-25')).toBe(0); // Sunday
    expect(weekday('2026-10-23')).toBe(5); // Friday
    expect(weekday('2026-10-31')).toBe(6); // Saturday
  });
});

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
