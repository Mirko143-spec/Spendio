import { countsAsSpending, isSavingsTransfer, type Category } from './categories.ts';
import type { Ore } from './money.ts';
import { DEFAULT_PERIOD_SETTINGS, periodRange, type Period, type PeriodLabel, type PeriodSettings } from './periods.ts';

/**
 * Period totals for the dashboard and savings page (docs/SPEC.md §6, §11).
 *
 * - Spending categories are net: money in assigned to a spending category (refunds, friends
 *   paying back) reduces that category's total.
 * - Income and transfers never count as spending.
 * - Needs-review transactions (no category) are left out of every total and reported
 *   separately, so the UI can say how much is still uncategorized.
 */

export interface SummaryTransaction {
  amount: Ore;
  effectiveDate: string;
  categoryId: string | null;
}

export interface PeriodSummary {
  period: Period;
  /** Net spent per spending category (positive = money out). Only categories with transactions. */
  spentByCategory: Record<string, Ore>;
  /** Sum of `spentByCategory`. */
  netSpending: Ore;
  income: Ore;
  /** income − netSpending. */
  leftOver: Ore;
  /** leftOver / income, or null when there is no income. */
  savingsRate: number | null;
  /** Net money moved to savings accounts (out minus back in). */
  movedToSavings: Ore;
  needsReview: { count: number; moneyOut: Ore; moneyIn: Ore };
}

export function summarizePeriod(
  transactions: readonly SummaryTransaction[],
  categories: readonly Category[],
  label: PeriodLabel,
  settings: PeriodSettings = DEFAULT_PERIOD_SETTINGS,
): PeriodSummary {
  const period = periodRange(label, settings);
  const byId = new Map(categories.map((c) => [c.id, c]));

  const spentByCategory: Record<string, Ore> = {};
  let income = 0;
  let movedToSavings = 0;
  const needsReview = { count: 0, moneyOut: 0, moneyIn: 0 };

  for (const t of transactions) {
    if (t.effectiveDate < period.start || t.effectiveDate > period.end) continue;
    const category = t.categoryId === null ? undefined : byId.get(t.categoryId);

    if (!category) {
      // Uncategorized, or pointing at a category that no longer exists.
      needsReview.count++;
      if (t.amount < 0) needsReview.moneyOut -= t.amount;
      else needsReview.moneyIn += t.amount;
    } else if (countsAsSpending(category)) {
      spentByCategory[category.id] = (spentByCategory[category.id] ?? 0) - t.amount;
    } else if (category.type === 'income') {
      income += t.amount;
    } else if (isSavingsTransfer(category)) {
      movedToSavings -= t.amount;
    }
    // Internal transfers count in nothing.
  }

  const netSpending = Object.values(spentByCategory).reduce((sum, v) => sum + v, 0);
  const leftOver = income - netSpending;
  return {
    period,
    spentByCategory,
    netSpending,
    income,
    leftOver,
    savingsRate: income > 0 ? leftOver / income : null,
    movedToSavings,
    needsReview,
  };
}

/** Relative change from `previous` to `current` (0.12 = +12 %), or null when previous is 0. */
export function percentChange(current: Ore, previous: Ore): number | null {
  return previous === 0 ? null : (current - previous) / Math.abs(previous);
}
