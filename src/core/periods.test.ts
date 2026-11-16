import { describe, expect, it } from 'vitest';
import { payday } from './periods.ts';

describe('payday (defaults: 25th, adjusted to banking day)', () => {
  it.each([
    [2026, 10, '2026-10-23'], // Sunday → Friday
    [2026, 11, '2026-11-25'], // Wednesday
    [2026, 12, '2026-12-23'], // Juldagen + Julafton → Wednesday
    [2027, 1, '2027-01-25'], // Monday
    [2027, 6, '2027-06-24'], // Midsommarafton on the 25th → Thursday
    [2027, 12, '2027-12-23'], // Saturday, Julafton on Friday → Thursday
  ])('%i-%i → %s', (year, month, expected) => {
    expect(payday(year, month)).toBe(expected);
  });

  it('gives one payday per month across a full year, always on or before the 25th', () => {
    for (let month = 1; month <= 12; month++) {
      const date = payday(2026, month);
      expect(date.slice(0, 7)).toBe(`2026-${String(month).padStart(2, '0')}`);
      expect(Number(date.slice(8))).toBeLessThanOrEqual(25);
    }
  });
});

describe('payday with other settings', () => {
  it('start day 1 is always the 1st, even on holidays and weekends', () => {
    expect(payday(2027, 1, { startDay: 1, adjustToBankingDay: true })).toBe('2027-01-01'); // Nyårsdagen
    expect(payday(2026, 11, { startDay: 1, adjustToBankingDay: true })).toBe('2026-11-01'); // Sunday
  });

  it('can skip the banking-day adjustment', () => {
    expect(payday(2026, 10, { startDay: 25, adjustToBankingDay: false })).toBe('2026-10-25');
  });

  it('supports other start days', () => {
    expect(payday(2026, 11, { startDay: 27, adjustToBankingDay: true })).toBe('2026-11-27'); // Friday
    expect(payday(2026, 12, { startDay: 27, adjustToBankingDay: true })).toBe('2026-12-23'); // Sun → before Christmas
  });

  it('may move back into the previous month when the start of a month is all holidays', () => {
    // Jan 2, 2027 is a Saturday; Jan 1 Nyårsdagen; Dec 31 Nyårsafton → Wed Dec 30.
    expect(payday(2027, 1, { startDay: 2, adjustToBankingDay: true })).toBe('2026-12-30');
  });

  it.each([0, 29, 31, 2.5, -1])('rejects start day %s', (startDay) => {
    expect(() => payday(2026, 11, { startDay, adjustToBankingDay: true })).toThrow(RangeError);
  });

  it('rejects invalid months', () => {
    expect(() => payday(2026, 13)).toThrow(RangeError);
  });
});
