import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CATEGORIES } from './categories.ts';
import { importCsv } from './import.ts';
import { buildSavings } from './savings.ts';

const fixture = readFileSync(join(import.meta.dirname, '../../fixtures/nordea-sample.csv'), 'utf8');
let seq = 0;
const { transactions } = importCsv(fixture, { existingFingerprints: new Set(), now: '2026-12-29T10:00:00.000Z', newId: () => `id-${++seq}` });

describe('buildSavings over Oct 2026 – Jan 2027 (hand-checked)', () => {
  const s = buildSavings(transactions, DEFAULT_CATEGORIES, '2027-01', 4);

  it('gives income, spending, left over, rate and money moved per period', () => {
    expect(s.periods.map((p) => [p.period.label, p.income, p.netSpending, p.leftOver, p.movedToSavings])).toEqual([
      ['2026-10', 0, 56240, -56240, 0], // no income yet: spent more than earned
      ['2026-11', 1459200, 20000, 1439200, 300000], // 5 000 kr to Lysa, 2 000 kr back
      ['2026-12', 1359200, 185906, 1173294, 0],
      ['2027-01', 1359200, 2700, 1356500, 500000],
    ]);
    expect(s.periods[0]!.savingsRate).toBeNull();
    expect(s.periods[1]!.savingsRate).toBeCloseTo(1439200 / 1459200);
  });

  it('totals the window', () => {
    expect(s.totals).toEqual({ income: 4177600, netSpending: 264846, leftOver: 3912754, movedToSavings: 800000 });
    expect(s.savingsRate).toBeCloseTo(3912754 / 4177600);
  });

  it('has no rate for a window without income', () => {
    expect(buildSavings(transactions, DEFAULT_CATEGORIES, '2026-10', 2).savingsRate).toBeNull();
  });
});
