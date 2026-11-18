import type { Ore } from './money.ts';
import type { PeriodLabel } from './periods.ts';

/**
 * Monthly budget limits (docs/SPEC.md §10).
 *
 * Each limit is a record with an `effectiveFrom` period. The limit for a period is the latest
 * record with `effectiveFrom <= period`, so changing a limit applies from then on and never
 * rewrites past periods. Removing a limit is a record with `amount: null`.
 */

export interface Budget {
  id: string;
  /** Spending category, or null for the overall limit across all spending. */
  categoryId: string | null;
  /** Limit in öre, or null = no limit from this period on. */
  amount: Ore | null;
  effectiveFrom: PeriodLabel;
}

/** The limit in force for `categoryId` (null = overall) in `period`, or null if none. */
export function limitFor(budgets: readonly Budget[], categoryId: string | null, period: PeriodLabel): Ore | null {
  let current: Budget | undefined;
  for (const b of budgets) {
    if (b.categoryId !== categoryId || b.effectiveFrom > period) continue;
    if (!current || b.effectiveFrom > current.effectiveFrom) current = b;
  }
  return current?.amount ?? null;
}

/**
 * Returns `budgets` with the limit for `categoryId` set from `fromPeriod` on.
 * Replaces a record for the same category and period; earlier records stay untouched.
 */
export function setLimit(
  budgets: readonly Budget[],
  categoryId: string | null,
  amount: Ore | null,
  fromPeriod: PeriodLabel,
  newId: () => string,
): Budget[] {
  if (amount !== null && (!Number.isSafeInteger(amount) || amount < 0)) {
    throw new RangeError(`Budget limit must be a non-negative whole number of öre, got ${amount}`);
  }
  const existing = budgets.find((b) => b.categoryId === categoryId && b.effectiveFrom === fromPeriod);
  if (existing) return budgets.map((b) => (b === existing ? { ...b, amount } : b));
  return [...budgets, { id: newId(), categoryId, amount, effectiveFrom: fromPeriod }];
}

export type BudgetStatus = 'on_track' | 'close' | 'over';

export interface BudgetProgress {
  status: BudgetStatus;
  /** spent / limit (0 when nothing is spent; Infinity when spending against a 0 limit). */
  ratio: number;
  /** limit − spent, never negative. */
  remaining: Ore;
  /** spent − limit when over, else 0. */
  overBy: Ore;
}

export const CLOSE_THRESHOLD = 0.8;

/** On track below 80 %, Close from 80 % up to and including 100 %, Over above 100 %. */
export function budgetProgress(spent: Ore, limit: Ore): BudgetProgress {
  const ratio = spent <= 0 ? 0 : limit === 0 ? Infinity : spent / limit;
  const status: BudgetStatus = ratio > 1 ? 'over' : ratio >= CLOSE_THRESHOLD ? 'close' : 'on_track';
  return {
    status,
    ratio,
    remaining: Math.max(0, limit - spent),
    overBy: Math.max(0, spent - limit),
  };
}
