import { budgetProgress, limitFor, type Budget, type BudgetProgress, type BudgetStatus } from './budgets.ts';
import { countsAsSpending, type Category } from './categories.ts';
import type { Ore } from './money.ts';
import { DEFAULT_PERIOD_SETTINGS, shiftPeriod, type PeriodLabel, type PeriodSettings } from './periods.ts';
import { needsReview } from './review.ts';
import { percentChange, summarizePeriod, type PeriodSummary, type SummaryTransaction } from './summary.ts';

/**
 * Everything the dashboard shows for one period (docs/SPEC.md §12), computed in one place so the
 * screen only renders.
 */

export interface CategoryRow {
  category: Category;
  /** Net spent this period (negative = money back, e.g. Swish from people). */
  spent: Ore;
  limit: Ore | null;
  progress: BudgetProgress | null;
}

export interface DashboardModel {
  summary: PeriodSummary;
  /** Change in net spending vs the previous period (0.12 = +12 %), or null without a previous total. */
  spentChange: number | null;
  overall: { limit: Ore | null; progress: BudgetProgress | null };
  /** Categories with a limit: Over first, then Close, then On track; fullest first within each. */
  budgeted: CategoryRow[];
  /** Spending categories without a limit that had spending, largest first. */
  unbudgeted: CategoryRow[];
  /** Categories without a limit whose money in exceeded money out, largest first. */
  moneyBack: CategoryRow[];
  /** Transactions waiting for review, across all periods. */
  needsReviewCount: number;
}

const STATUS_ORDER: Record<BudgetStatus, number> = { over: 0, close: 1, on_track: 2 };

export function buildDashboard(
  transactions: readonly (SummaryTransaction & { suggested: boolean })[],
  categories: readonly Category[],
  budgets: readonly Budget[],
  label: PeriodLabel,
  settings: PeriodSettings = DEFAULT_PERIOD_SETTINGS,
): DashboardModel {
  const summary = summarizePeriod(transactions, categories, label, settings);
  const previous = summarizePeriod(transactions, categories, shiftPeriod(label, -1), settings);

  const budgeted: CategoryRow[] = [];
  const unbudgeted: CategoryRow[] = [];
  const moneyBack: CategoryRow[] = [];

  for (const category of categories.filter(countsAsSpending)) {
    const spent = summary.spentByCategory[category.id] ?? 0;
    const limit = limitFor(budgets, category.id, label);
    if (limit !== null) {
      budgeted.push({ category, spent, limit, progress: budgetProgress(spent, limit) });
    } else if (spent > 0) {
      unbudgeted.push({ category, spent, limit, progress: null });
    } else if (spent < 0) {
      moneyBack.push({ category, spent, limit, progress: null });
    }
  }

  budgeted.sort(
    (a, b) => STATUS_ORDER[a.progress!.status] - STATUS_ORDER[b.progress!.status] || b.progress!.ratio - a.progress!.ratio,
  );
  unbudgeted.sort((a, b) => b.spent - a.spent);
  moneyBack.sort((a, b) => a.spent - b.spent);

  const overallLimit = limitFor(budgets, null, label);
  return {
    summary,
    spentChange: percentChange(summary.netSpending, previous.netSpending),
    overall: {
      limit: overallLimit,
      progress: overallLimit === null ? null : budgetProgress(summary.netSpending, overallLimit),
    },
    budgeted,
    unbudgeted,
    moneyBack,
    needsReviewCount: transactions.filter(needsReview).length,
  };
}
