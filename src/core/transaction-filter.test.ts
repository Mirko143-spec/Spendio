import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATEGORY_IDS as C } from './categories.ts';
import { importCsv } from './import.ts';
import { filterTransactions, NO_FILTER } from './transaction-filter.ts';

const fixture = readFileSync(join(import.meta.dirname, '../../fixtures/nordea-sample.csv'), 'utf8');
let seq = 0;
const { transactions } = importCsv(fixture, { existingFingerprints: new Set(), now: '2026-12-29T10:00:00.000Z', newId: () => `id-${++seq}` });
const keys = (ts: { merchantKey: string }[]) => ts.map((t) => t.merchantKey);

describe('filterTransactions', () => {
  it('returns everything newest first without a filter', () => {
    const all = filterTransactions(transactions, NO_FILTER);
    expect(all).toHaveLength(28);
    const dates = all.map((t) => t.effectiveDate);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it('limits to a payday period by effective date', () => {
    const november = filterTransactions(transactions, { ...NO_FILTER, period: '2026-11' });
    expect(november).toHaveLength(17);
    // Bought on payday eve, booked on payday: still November.
    expect(keys(november)).toContain('PARKSTER SWE');
  });

  it('filters by category', () => {
    expect(keys(filterTransactions(transactions, { ...NO_FILTER, category: C.gaming }))).toEqual([
      'ROBLOX.COM',
      'ROBLOX.COM',
      'STEAM PURCHASE',
    ]);
  });

  it('shows everything waiting for review, including unconfirmed suggestions', () => {
    const review = filterTransactions(transactions, { ...NO_FILTER, category: 'needs-review' });
    expect(review).toHaveLength(6);
    expect(review.some((t) => t.suggested)).toBe(true);
    expect(review.some((t) => t.categoryId === null)).toBe(true);
  });

  it('filters by transaction kind', () => {
    expect(filterTransactions(transactions, { ...NO_FILTER, kind: 'swish_in' })).toHaveLength(2);
  });

  it('searches merchant, tidied person names and bank text, case-insensitively, all words', () => {
    expect(keys(filterTransactions(transactions, { ...NO_FILTER, query: 'roblox' }))).toEqual(['ROBLOX.COM', 'ROBLOX.COM']);
    expect(keys(filterTransactions(transactions, { ...NO_FILTER, query: 'john doe' }))).toEqual(['DOE,JOHN']);
    expect(keys(filterTransactions(transactions, { ...NO_FILTER, query: 'autogiro lysa' }))).toEqual(['LYSA SPAR', 'LYSA SPAR']);
    expect(filterTransactions(transactions, { ...NO_FILTER, query: 'nothing matches this' })).toEqual([]);
  });

  it('combines filters', () => {
    const r = filterTransactions(transactions, { period: '2026-11', category: C.transport, kind: 'card', query: 'sj' });
    expect(keys(r)).toEqual(['SJ.SE']);
  });
});
