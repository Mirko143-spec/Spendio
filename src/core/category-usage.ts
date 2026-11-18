import type { Budget } from './budgets.ts';
import type { Rule } from './rules.ts';

/** How much depends on a category, so deleting it can say what will move (docs/SPEC.md §6). */
export interface CategoryUsage {
  transactions: number;
  rules: number;
  /** Limit records (any period); they're removed with the category. */
  limits: number;
}

export function usageByCategory(
  transactions: readonly { categoryId: string | null }[],
  rules: readonly Pick<Rule, 'categoryId'>[],
  budgets: readonly Pick<Budget, 'categoryId'>[],
): Map<string, CategoryUsage> {
  const usage = new Map<string, CategoryUsage>();
  const entry = (id: string) => {
    let u = usage.get(id);
    if (!u) usage.set(id, (u = { transactions: 0, rules: 0, limits: 0 }));
    return u;
  };
  for (const t of transactions) if (t.categoryId) entry(t.categoryId).transactions++;
  for (const r of rules) entry(r.categoryId).rules++;
  for (const b of budgets) if (b.categoryId) entry(b.categoryId).limits++;
  return usage;
}
