import { budgetProgress, limitFor, type Budget, type BudgetProgress } from './budgets.ts';
import { countsAsSpending, type Category } from './categories.ts';
import type { Ore } from './money.ts';
import { DEFAULT_PERIOD_SETTINGS, shiftPeriod, type Period, type PeriodLabel, type PeriodSettings } from './periods.ts';
import { summarizePeriod, type SummaryTransaction } from './summary.ts';

/**
 * Month-by-month spending against each month's own limit (docs/SPEC.md §12 History): answers
 * "do I keep going over on Restaurants?". Limits are looked up per period, so a raised limit
 * never rewrites how earlier months are judged.
 */

export interface HistoryCell {
  label: PeriodLabel;
  /** Net spent (negative = money back). */
  spent: Ore;
  /** The limit in force that period, or null. */
  limit: Ore | null;
  progress: BudgetProgress | null;
}

export interface HistoryRow {
  /** null = all spending (the overall limit). */
  category: Category | null;
  /** Oldest period first, matching `HistoryModel.periods`. */
  cells: HistoryCell[];
  /** Periods over the limit. */
  overCount: number;
  /** Periods that had a limit. */
  limitedCount: number;
}

export interface HistoryModel {
  /** Oldest first. */
  periods: Period[];
  /** "All spending" first, then categories with limits (most often over first), then the rest by total spent. */
  rows: HistoryRow[];
}

export function buildHistory(
  transactions: readonly SummaryTransaction[],
  categories: readonly Category[],
  budgets: readonly Budget[],
  lastLabel: PeriodLabel,
  count: number,
  settings: PeriodSettings = DEFAULT_PERIOD_SETTINGS,
): HistoryModel {
  const labels = Array.from({ length: count }, (_, i) => shiftPeriod(lastLabel, i - count + 1));
  const summaries = labels.map((label) => summarizePeriod(transactions, categories, label, settings));

  const row = (category: Category | null): HistoryRow => {
    const cells = summaries.map((s): HistoryCell => {
      const spent = category ? (s.spentByCategory[category.id] ?? 0) : s.netSpending;
      const limit = limitFor(budgets, category?.id ?? null, s.period.label);
      return { label: s.period.label, spent, limit, progress: limit === null ? null : budgetProgress(spent, limit) };
    });
    return {
      category,
      cells,
      overCount: cells.filter((c) => c.progress?.status === 'over').length,
      limitedCount: cells.filter((c) => c.limit !== null).length,
    };
  };

  const total = (r: HistoryRow) => r.cells.reduce((sum, c) => sum + c.spent, 0);
  const categoryRows = categories
    .filter(countsAsSpending)
    .map(row)
    // Keep categories that had spending in the window or have a limit; money-back-only rows are left out.
    .filter((r) => r.limitedCount > 0 || total(r) > 0)
    .sort(
      (a, b) =>
        Number(b.limitedCount > 0) - Number(a.limitedCount > 0) ||
        b.overCount - a.overCount ||
        total(b) - total(a),
    );

  return { periods: summaries.map((s) => s.period), rows: [row(null), ...categoryRows] };
}
