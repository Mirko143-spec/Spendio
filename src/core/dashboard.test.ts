import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Budget } from './budgets.ts';
import { CATEGORY_IDS as C, DEFAULT_CATEGORIES } from './categories.ts';
import { buildDashboard } from './dashboard.ts';
import { importCsv } from './import.ts';

const fixture = readFileSync(join(import.meta.dirname, '../../fixtures/nordea-sample.csv'), 'utf8');
let seq = 0;
const { transactions } = importCsv(fixture, {
  existingFingerprints: new Set(),
  now: '2026-12-29T10:00:00.000Z',
  newId: () => `id-${++seq}`,
});

const budget = (categoryId: string | null, amount: number | null, effectiveFrom = '2026-10'): Budget => ({
  id: `b-${categoryId}-${effectiveFrom}`,
  categoryId,
  amount,
  effectiveFrom,
});

describe('buildDashboard for November 2026 (Oct 23 – Nov 24)', () => {
  const budgets = [
    budget(C.gaming, 30000), // 329 kr spent → over
    budget(C.transport, 80000), // 669 kr spent → close (84 %)
    budget(C.restaurants, 50000), // 152 kr spent → on track
    budget(C.groceries, 100000), // nothing spent → on track
    budget(null, 1000000), // overall
  ];
  const d = buildDashboard(transactions, DEFAULT_CATEGORIES, budgets, '2026-11');

  it('lists budgeted categories Over → Close → On track, fullest first', () => {
    expect(d.budgeted.map((r) => [r.category.id, r.spent, r.progress!.status])).toEqual([
      [C.gaming, 32900, 'over'],
      [C.transport, 66900, 'close'],
      [C.restaurants, 15200, 'on_track'],
      [C.groceries, 0, 'on_track'],
    ]);
    expect(d.budgeted[0]!.progress!.overBy).toBe(2900);
  });

  it('lists other spending largest first, and money back separately', () => {
    expect(d.unbudgeted.map((r) => [r.category.id, r.spent])).toEqual([
      [C.health, 54600],
      [C.subscriptions, 12900],
    ]);
    expect(d.moneyBack.map((r) => [r.category.id, r.spent])).toEqual([[C.swishFromPeople, -162500]]);
  });

  it('compares spending with the previous period', () => {
    // October (Sep 25 – Oct 22) net spending: 312,40 + 250 kr = 56 240 öre.
    expect(d.summary.netSpending).toBe(20000);
    expect(d.spentChange).toBeCloseTo((20000 - 56240) / 56240);
  });

  it('applies the overall limit to net spending', () => {
    expect(d.overall).toEqual({
      limit: 1000000,
      progress: { status: 'on_track', ratio: 0.02, remaining: 980000, overBy: 0 },
    });
  });

  it('counts everything waiting for review across all periods', () => {
    // 3 without a category (Swish to a shop, a refund, an unknown shop) + 3 Swish suggestions.
    expect(d.needsReviewCount).toBe(6);
  });
});

describe('buildDashboard edge cases', () => {
  it('works without budgets and without a previous period', () => {
    const d = buildDashboard(transactions, DEFAULT_CATEGORIES, [], '2026-10');
    expect(d.budgeted).toEqual([]);
    expect(d.overall).toEqual({ limit: null, progress: null });
    expect(d.spentChange).toBeNull(); // nothing spent in September
  });

  it('uses the limit in force for the period, not a later one', () => {
    const budgets = [budget(C.gaming, 30000, '2026-10'), budget(C.gaming, 100000, '2026-12')];
    expect(buildDashboard(transactions, DEFAULT_CATEGORIES, budgets, '2026-11').budgeted[0]!.limit).toBe(30000);
    expect(buildDashboard(transactions, DEFAULT_CATEGORIES, budgets, '2026-12').budgeted[0]!.limit).toBe(100000);
  });

  it('shows an empty period as empty', () => {
    const d = buildDashboard(transactions, DEFAULT_CATEGORIES, [], '2027-06');
    expect([d.unbudgeted, d.moneyBack, d.summary.netSpending]).toEqual([[], [], 0]);
  });
});
