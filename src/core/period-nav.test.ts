import { describe, expect, it } from 'vitest';
import { periodBounds } from './period-nav.ts';

const at = (...dates: string[]) => dates.map((effectiveDate) => ({ effectiveDate }));

describe('periodBounds (payday periods)', () => {
  it('opens on today’s period when it has data', () => {
    // Today Dec 1 2026 is in the December period (Nov 25 – Dec 22).
    expect(periodBounds(at('2026-10-20', '2026-11-30'), '2026-12-01')).toEqual({
      first: '2026-10',
      last: '2026-12',
      initial: '2026-12',
    });
  });

  it('opens on the latest period with data when today’s period is empty', () => {
    // A November statement imported in mid-December.
    expect(periodBounds(at('2026-10-30', '2026-11-20'), '2026-12-15')).toEqual({
      first: '2026-11',
      last: '2026-12',
      initial: '2026-11',
    });
  });

  it('opens on today’s period when there is no data at all', () => {
    expect(periodBounds([], '2026-12-15')).toEqual({ first: '2026-12', last: '2026-12', initial: '2026-12' });
  });

  it('respects the period settings', () => {
    expect(periodBounds(at('2026-11-30'), '2026-12-01', { startDay: 1, adjustToBankingDay: true })).toEqual({
      first: '2026-11',
      last: '2026-12',
      initial: '2026-11',
    });
  });
});
