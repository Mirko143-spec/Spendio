import { describe, expect, it } from 'vitest';
import { CATEGORY_IDS as C, DEFAULT_CATEGORIES } from './categories.ts';
import { percentChange, summarizePeriod, type SummaryTransaction } from './summary.ts';

// December 2026 period with defaults: Nov 25 – Dec 22.
const tx = (effectiveDate: string, amount: number, categoryId: string | null): SummaryTransaction => ({
  effectiveDate,
  amount,
  categoryId,
});

describe('summarizePeriod', () => {
  const transactions = [
    tx('2026-11-24', -99900, C.restaurants), // previous period: excluded
    tx('2026-11-25', 1359200, C.income),
    tx('2026-11-26', -90000, C.restaurants), // dinner paid for a group
    tx('2026-11-27', 45000, C.restaurants), // a friend pays back their share
    tx('2026-12-01', -16900, C.subscriptions),
    tx('2026-12-05', -800000, C.savings), // to Lysa
    tx('2026-12-10', 300000, C.savings), // back from Lysa
    tx('2026-12-11', -50000, C.internal), // between own accounts
    tx('2026-12-12', -8000, null), // needs review
    tx('2026-12-13', 150000, null), // needs review
    tx('2026-12-14', -2500, 'deleted-category'), // stale category id → needs review
    tx('2026-12-22', -10000, C.groceries), // last day: included
    tx('2026-12-23', -77700, C.groceries), // next period: excluded
  ];
  const s = summarizePeriod(transactions, DEFAULT_CATEGORIES, '2026-12');

  it('reports the period range', () => {
    expect(s.period).toEqual({ label: '2026-12', start: '2026-11-25', end: '2026-12-22' });
  });

  it('nets incoming money against its spending category', () => {
    expect(s.spentByCategory).toEqual({ [C.restaurants]: 45000, [C.subscriptions]: 16900, [C.groceries]: 10000 });
    expect(s.netSpending).toBe(71900);
  });

  it('computes income, left over and savings rate', () => {
    expect(s.income).toBe(1359200);
    expect(s.leftOver).toBe(1359200 - 71900);
    expect(s.savingsRate).toBeCloseTo((1359200 - 71900) / 1359200);
  });

  it('nets savings transfers and ignores internal transfers', () => {
    expect(s.movedToSavings).toBe(500000);
  });

  it('keeps needs-review money out of all totals and reports it separately', () => {
    expect(s.needsReview).toEqual({ count: 3, moneyOut: 10500, moneyIn: 150000 });
  });

  it('reports a net refund as negative spending', () => {
    const refund = summarizePeriod(
      [tx('2026-12-01', -10000, C.shopping), tx('2026-12-02', 30000, C.shopping)],
      DEFAULT_CATEGORIES,
      '2026-12',
    );
    expect(refund.spentByCategory[C.shopping]).toBe(-20000);
  });

  it('returns null savings rate and negative left over without income', () => {
    const noIncome = summarizePeriod([tx('2026-12-01', -10000, C.groceries)], DEFAULT_CATEGORIES, '2026-12');
    expect(noIncome).toMatchObject({ income: 0, leftOver: -10000, savingsRate: null });
  });

  it('respects period settings', () => {
    const calendar = { startDay: 1, adjustToBankingDay: true };
    const c = summarizePeriod(transactions, DEFAULT_CATEGORIES, '2026-11', calendar);
    expect(c.period).toEqual({ label: '2026-11', start: '2026-11-01', end: '2026-11-30' });
    expect(c.spentByCategory).toEqual({ [C.restaurants]: 99900 + 90000 - 45000 });
  });
});

describe('percentChange', () => {
  it('computes relative change, or null from zero', () => {
    expect(percentChange(112, 100)).toBeCloseTo(0.12);
    expect(percentChange(50, 100)).toBeCloseTo(-0.5);
    expect(percentChange(100, 0)).toBeNull();
    expect(percentChange(-50, -100)).toBeCloseTo(0.5);
  });
});

describe('splitting a bill with Swish', () => {
  it('lowers spending, not raises income, when a friend pays back via "Swish from people"', () => {
    // Pay 900 kr for dinner by card; a friend Swishes back their half.
    const s = summarizePeriod(
      [tx('2026-12-01', 1359200, C.income), tx('2026-12-05', -90000, C.restaurants), tx('2026-12-06', 45000, C.swishFromPeople)],
      DEFAULT_CATEGORIES,
      '2026-12',
    );
    expect(s.netSpending).toBe(45000);
    expect(s.income).toBe(1359200);
    expect(s.spentByCategory).toEqual({ [C.restaurants]: 90000, [C.swishFromPeople]: -45000 });
    expect(s.leftOver).toBe(1359200 - 45000);
  });
});
