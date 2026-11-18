import type { Category } from './categories.ts';
import type { Ore } from './money.ts';
import { DEFAULT_PERIOD_SETTINGS, shiftPeriod, type Period, type PeriodLabel, type PeriodSettings } from './periods.ts';
import { summarizePeriod, type SummaryTransaction } from './summary.ts';

/**
 * Savings over time (docs/SPEC.md §11): what was left over each period (income − net spending),
 * the savings rate, and money moved to savings accounts (e.g. Lysa), with totals for the window.
 */

export interface SavingsPeriod {
  period: Period;
  income: Ore;
  netSpending: Ore;
  /** income − netSpending; negative when more was spent than earned. */
  leftOver: Ore;
  /** leftOver / income, or null without income. */
  savingsRate: number | null;
  /** Net money moved to savings (negative when more was taken out than put in). */
  movedToSavings: Ore;
}

export interface SavingsModel {
  /** Oldest first. */
  periods: SavingsPeriod[];
  totals: { income: Ore; netSpending: Ore; leftOver: Ore; movedToSavings: Ore };
  /** Total left over / total income over the window, or null without income. */
  savingsRate: number | null;
}

export function buildSavings(
  transactions: readonly SummaryTransaction[],
  categories: readonly Category[],
  lastLabel: PeriodLabel,
  count: number,
  settings: PeriodSettings = DEFAULT_PERIOD_SETTINGS,
): SavingsModel {
  const periods = Array.from({ length: count }, (_, i) => {
    const s = summarizePeriod(transactions, categories, shiftPeriod(lastLabel, i - count + 1), settings);
    return {
      period: s.period,
      income: s.income,
      netSpending: s.netSpending,
      leftOver: s.leftOver,
      savingsRate: s.savingsRate,
      movedToSavings: s.movedToSavings,
    };
  });
  const sum = (pick: (p: SavingsPeriod) => Ore) => periods.reduce((total, p) => total + pick(p), 0);
  const totals = {
    income: sum((p) => p.income),
    netSpending: sum((p) => p.netSpending),
    leftOver: sum((p) => p.leftOver),
    movedToSavings: sum((p) => p.movedToSavings),
  };
  return { periods, totals, savingsRate: totals.income > 0 ? totals.leftOver / totals.income : null };
}
