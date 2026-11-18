import { describe, expect, it } from 'vitest';
import { budgetProgress, limitFor, setLimit, type Budget } from './budgets.ts';

let seq = 0;
const newId = () => `b${++seq}`;
const GAMING = 'gaming';

describe('limitFor', () => {
  const budgets: Budget[] = [
    { id: '1', categoryId: GAMING, amount: 100000, effectiveFrom: '2026-11' },
    { id: '2', categoryId: GAMING, amount: 150000, effectiveFrom: '2027-01' },
    { id: '3', categoryId: GAMING, amount: null, effectiveFrom: '2027-03' },
    { id: '4', categoryId: null, amount: 1200000, effectiveFrom: '2026-11' },
  ];

  it.each<[string, number | null, string]>([
    ['2026-10', null, 'before any limit'],
    ['2026-11', 100000, 'first limit'],
    ['2026-12', 100000, 'standing limit carries forward'],
    ['2027-01', 150000, 'changed limit'],
    ['2027-02', 150000, 'changed limit carries forward'],
    ['2027-03', null, 'limit removed'],
  ])('%s → %s (%s)', (period, expected) => {
    expect(limitFor(budgets, GAMING, period)).toBe(expected);
  });

  it('keeps the overall limit separate from category limits', () => {
    expect(limitFor(budgets, null, '2027-05')).toBe(1200000);
    expect(limitFor(budgets, 'groceries', '2027-05')).toBeNull();
  });

  it('ignores record order', () => {
    expect(limitFor([...budgets].reverse(), GAMING, '2027-02')).toBe(150000);
  });
});

describe('setLimit', () => {
  it('never rewrites past periods when a limit changes', () => {
    let budgets = setLimit([], GAMING, 100000, '2026-11', newId);
    budgets = setLimit(budgets, GAMING, 200000, '2026-12', newId);
    expect(limitFor(budgets, GAMING, '2026-11')).toBe(100000);
    expect(limitFor(budgets, GAMING, '2026-12')).toBe(200000);
  });

  it('replaces the record when changed again in the same period', () => {
    let budgets = setLimit([], GAMING, 100000, '2026-12', newId);
    budgets = setLimit(budgets, GAMING, 80000, '2026-12', newId);
    expect(budgets).toHaveLength(1);
    expect(limitFor(budgets, GAMING, '2026-12')).toBe(80000);
  });

  it('removes a limit from a period on with null', () => {
    let budgets = setLimit([], GAMING, 100000, '2026-11', newId);
    budgets = setLimit(budgets, GAMING, null, '2027-01', newId);
    expect(limitFor(budgets, GAMING, '2026-12')).toBe(100000);
    expect(limitFor(budgets, GAMING, '2027-01')).toBeNull();
  });

  it('does not mutate its input', () => {
    const original: Budget[] = [{ id: 'x', categoryId: GAMING, amount: 1, effectiveFrom: '2026-11' }];
    setLimit(original, GAMING, 2, '2026-11', newId);
    expect(original[0]!.amount).toBe(1);
  });

  it.each([-1, 1.5, Number.NaN])('rejects invalid amount %s', (amount) => {
    expect(() => setLimit([], GAMING, amount, '2026-11', newId)).toThrow(RangeError);
  });
});

describe('budgetProgress', () => {
  it.each([
    [0, 100000, 'on_track'],
    [79999, 100000, 'on_track'],
    [80000, 100000, 'close'],
    [100000, 100000, 'close'],
    [100001, 100000, 'over'],
    [295000, 100000, 'over'],
  ] as const)('%i of %i → %s', (spent, limit, status) => {
    expect(budgetProgress(spent, limit).status).toBe(status);
  });

  it('reports remaining and overage', () => {
    expect(budgetProgress(78000, 100000)).toEqual({ status: 'on_track', ratio: 0.78, remaining: 22000, overBy: 0 });
    expect(budgetProgress(295000, 100000)).toMatchObject({ remaining: 0, overBy: 195000 });
  });

  it('treats net refunds (negative spending) as on track', () => {
    expect(budgetProgress(-5000, 100000)).toEqual({ status: 'on_track', ratio: 0, remaining: 105000, overBy: 0 });
  });

  it('handles a zero limit', () => {
    expect(budgetProgress(0, 0).status).toBe('on_track');
    expect(budgetProgress(1, 0)).toMatchObject({ status: 'over', ratio: Infinity, overBy: 1 });
  });
});
