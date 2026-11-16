import { describe, expect, it } from 'vitest';
import { addDays } from './dates.ts';
import { DEFAULT_PERIOD_SETTINGS, payday, periodOf, periodRange, shiftPeriod, type PeriodSettings } from './periods.ts';

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

describe('periodRange (defaults)', () => {
  it.each([
    ['2026-11', '2026-10-23', '2026-11-24'],
    ['2026-12', '2026-11-25', '2026-12-22'],
    ['2027-01', '2026-12-23', '2027-01-24'],
  ])('%s runs %s – %s', (label, start, end) => {
    expect(periodRange(label)).toEqual({ label, start, end });
  });
});

describe('periodOf (defaults)', () => {
  it.each([
    ['2026-11-24', '2026-11', 'payday eve'],
    ['2026-11-25', '2026-12', 'payday starts December'],
    ['2026-12-22', '2026-12', 'last day before the early December payday'],
    ['2026-12-23', '2027-01', 'December payday starts January'],
    ['2026-12-31', '2027-01', 'year boundary'],
  ])('%s → %s (%s)', (date, label) => {
    expect(periodOf(date)).toBe(label);
  });

  it('puts the fixture purchase made on payday eve (booked on payday) in November', () => {
    // "Kortköp 261124 PARKSTER SWE", booked 2026-11-25: effective date is the purchase date.
    expect(periodOf('2026-11-24')).toBe('2026-11');
    expect(periodOf('2026-11-25')).toBe('2026-12');
  });
});

describe('calendar months (start day 1)', () => {
  const calendar = { startDay: 1, adjustToBankingDay: true };

  it('labels each period with its own month', () => {
    expect(periodRange('2026-11', calendar)).toEqual({ label: '2026-11', start: '2026-11-01', end: '2026-11-30' });
    expect(periodRange('2028-02', calendar)).toEqual({ label: '2028-02', start: '2028-02-01', end: '2028-02-29' });
    expect(periodOf('2026-11-30', calendar)).toBe('2026-11');
    expect(periodOf('2026-12-01', calendar)).toBe('2026-12');
  });
});

describe('other start days', () => {
  it('start day 10 is labelled by the month it starts in', () => {
    const s = { startDay: 10, adjustToBankingDay: true };
    expect(periodRange('2026-11', s)).toEqual({ label: '2026-11', start: '2026-11-10', end: '2026-12-09' });
  });

  it('handles a period start that moves back into the previous month', () => {
    // startDay 2: Jan 2027 period starts Wed Dec 30 2026 (see payday tests).
    const s = { startDay: 2, adjustToBankingDay: true };
    expect(periodRange('2027-01', s).start).toBe('2026-12-30');
    expect(periodOf('2026-12-31', s)).toBe('2027-01');
    expect(periodOf('2026-12-29', s)).toBe('2026-12');
  });
});

describe('period invariants', () => {
  const settingsList = [
    DEFAULT_PERIOD_SETTINGS,
    { startDay: 1, adjustToBankingDay: true },
    { startDay: 2, adjustToBankingDay: true },
    { startDay: 15, adjustToBankingDay: true },
    { startDay: 16, adjustToBankingDay: true },
    { startDay: 28, adjustToBankingDay: false },
  ];

  it.each(settingsList)('periods are contiguous with no gaps or overlaps (%o)', (settings) => {
    let label = '2025-01';
    for (let i = 0; i < 48; i++) {
      const current = periodRange(label, settings);
      const next = periodRange(shiftPeriod(label, 1), settings);
      expect(next.start).toBe(addDays(current.end, 1));
      expect(current.start <= current.end).toBe(true);
      label = shiftPeriod(label, 1);
    }
  });

  it.each(settingsList)('every day maps to the period whose range contains it (%o)', (settings) => {
    for (let date = '2026-01-01'; date <= '2027-12-31'; date = addDays(date, 1)) {
      const range = periodRange(periodOf(date, settings), settings);
      expect(date >= range.start && date <= range.end).toBe(true);
    }
  });

  /** Share of the period's days that fall in its label month, for 48 consecutive periods. */
  function labelMonthShares(settings: PeriodSettings): number[] {
    const shares: number[] = [];
    for (let i = 0, label = '2025-01'; i < 48; i++, label = shiftPeriod(label, 1)) {
      const { start, end } = periodRange(label, settings);
      let total = 0;
      let inLabelMonth = 0;
      for (let d = start; d <= end; d = addDays(d, 1)) {
        total++;
        if (d.startsWith(label)) inLabelMonth++;
      }
      shares.push(inLabelMonth / total);
    }
    return shares;
  }

  it.each([DEFAULT_PERIOD_SETTINGS, { startDay: 1, adjustToBankingDay: true }])(
    'with real-world settings, most of every period is in its label month (%o)',
    (settings) => {
      for (const share of labelMonthShares(settings)) expect(share).toBeGreaterThan(0.5);
    },
  );

  it.each(settingsList)('with any setting, the label month holds a large share of the period (%o)', (settings) => {
    // Mid-month start days split a period roughly in half, so the label is a convention there.
    for (const share of labelMonthShares(settings)) expect(share).toBeGreaterThanOrEqual(0.4);
  });
});

describe('shiftPeriod', () => {
  it('moves across year boundaries', () => {
    expect(shiftPeriod('2026-12', 1)).toBe('2027-01');
    expect(shiftPeriod('2027-01', -1)).toBe('2026-12');
    expect(shiftPeriod('2026-11', -23)).toBe('2024-12');
  });

  it.each(['2026-13', '2026-1', '26-11', 'november'])('rejects label %s', (label) => {
    expect(() => shiftPeriod(label, 1)).toThrow(RangeError);
  });
});
