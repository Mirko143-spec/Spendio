import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Budget } from './budgets.ts';
import { CATEGORY_IDS as C, DEFAULT_CATEGORIES } from './categories.ts';
import { buildHistory } from './history.ts';
import { importCsv } from './import.ts';

const fixture = readFileSync(join(import.meta.dirname, '../../fixtures/nordea-sample.csv'), 'utf8');
let seq = 0;
const { transactions } = importCsv(fixture, { existingFingerprints: new Set(), now: '2026-12-29T10:00:00.000Z', newId: () => `id-${++seq}` });

const budget = (categoryId: string | null, amount: number, effectiveFrom: string): Budget => ({
  id: `${categoryId}-${effectiveFrom}`,
  categoryId,
  amount,
  effectiveFrom,
});

describe('buildHistory over Oct 2026 – Jan 2027', () => {
  const budgets = [
    budget(C.groceries, 50000, '2026-10'), // Oct 312 kr, Nov 0, Dec 1 645 kr (over), Jan 0
    budget(C.groceries, 200000, '2027-01'), // raised in January: December stays "over"
    budget(null, 100000, '2026-11'), // overall from November
  ];
  const h = buildHistory(transactions, DEFAULT_CATEGORIES, budgets, '2027-01', 4);

  it('covers the requested periods, oldest first', () => {
    expect(h.periods.map((p) => p.label)).toEqual(['2026-10', '2026-11', '2026-12', '2027-01']);
  });

  it('starts with all spending, judged against each month’s overall limit', () => {
    const all = h.rows[0]!;
    expect(all.category).toBeNull();
    expect(all.cells.map((c) => [c.spent, c.limit, c.progress?.status ?? null])).toEqual([
      [56240, null, null],
      [20000, 100000, 'on_track'],
      [185906, 100000, 'over'],
      [2700, 100000, 'on_track'],
    ]);
    expect([all.overCount, all.limitedCount]).toEqual([1, 3]);
  });

  it('never rewrites earlier months when a limit is raised', () => {
    const groceries = h.rows.find((r) => r.category?.id === C.groceries)!;
    expect(groceries.cells.map((c) => [c.label, c.limit, c.progress?.status])).toEqual([
      ['2026-10', 50000, 'on_track'],
      ['2026-11', 50000, 'on_track'],
      ['2026-12', 50000, 'over'],
      ['2027-01', 200000, 'on_track'],
    ]);
    expect(groceries.overCount).toBe(1);
  });

  it('lists categories with limits first, then the rest by total spent', () => {
    expect(h.rows.slice(1).map((r) => r.category!.id)).toEqual([
      C.groceries,
      C.transport,
      C.health, // 546 kr
      C.gaming, // 329 kr
      C.subscriptions, // 298 kr
      C.swishPeople, // 250 kr
      C.restaurants, // 179 kr
      C.shopping, // 45,50 kr
    ]);
  });

  it('leaves out categories that only had money back', () => {
    expect(h.rows.some((r) => r.category?.id === C.swishFromPeople)).toBe(false);
  });
});

describe('buildHistory edge cases', () => {
  it('shows a limited category even in a window without spending', () => {
    const h = buildHistory(transactions, DEFAULT_CATEGORIES, [budget(C.travel, 100000, '2026-01')], '2027-06', 2);
    expect(h.rows.map((r) => r.category?.id ?? 'all')).toEqual(['all', C.travel]);
    expect(h.rows[1]!.cells.every((c) => c.spent === 0 && c.progress?.status === 'on_track')).toBe(true);
  });
});
