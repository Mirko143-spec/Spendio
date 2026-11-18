import type { TransactionKind } from './formats/types.ts';
import type { Transaction } from './import.ts';
import type { Ore } from './money.ts';

/**
 * Groups transactions that need a decision for the post-import review (docs/SPEC.md §7.5, §12):
 * everything in Needs review, plus guesses (`suggested`) the user should confirm.
 *
 * One group per merchant and kind, so "Swish to Anna" and "Swish from Anna" are separate
 * decisions (paying a friend and being paid back are different things).
 */

export interface ReviewGroup {
  /** Stable key for UI lists and decisions. */
  key: string;
  merchantKey: string;
  merchantDisplay: string;
  kind: TransactionKind;
  transactionIds: string[];
  /** Signed sum (negative = money out). */
  total: Ore;
  /** ISO dates of the first and last transaction in the group. */
  firstDate: string;
  lastDate: string;
  /** The category every transaction in the group was guessed as, or null. */
  suggestedCategoryId: string | null;
  /** A private person (Swish), whose payments rarely mean the same thing every time. */
  isPerson: boolean;
  /** Default for "Remember for future imports": on, except for people. */
  rememberByDefault: boolean;
}

export function needsReview(t: Pick<Transaction, 'categoryId' | 'suggested'>): boolean {
  return t.categoryId === null || t.suggested;
}

export function groupForReview(transactions: readonly Transaction[]): ReviewGroup[] {
  const groups = new Map<string, ReviewGroup>();
  const suggestions = new Map<string, Set<string | null>>();

  for (const t of transactions) {
    if (!needsReview(t)) continue;
    const key = `${t.kind}\u001F${t.merchantKey}`;
    let group = groups.get(key);
    if (!group) {
      const isPerson = t.counterpartyIsPerson === true;
      group = {
        key,
        merchantKey: t.merchantKey,
        merchantDisplay: t.merchantDisplay,
        kind: t.kind,
        transactionIds: [],
        total: 0,
        firstDate: t.effectiveDate,
        lastDate: t.effectiveDate,
        suggestedCategoryId: null,
        isPerson,
        rememberByDefault: !isPerson,
      };
      groups.set(key, group);
      suggestions.set(key, new Set());
    }
    group.transactionIds.push(t.id);
    group.total += t.amount;
    if (t.effectiveDate < group.firstDate) group.firstDate = t.effectiveDate;
    if (t.effectiveDate > group.lastDate) group.lastDate = t.effectiveDate;
    suggestions.get(key)!.add(t.suggested ? t.categoryId : null);
  }

  for (const [key, group] of groups) {
    const s = suggestions.get(key)!;
    group.suggestedCategoryId = s.size === 1 ? [...s][0]! : null;
  }

  return [...groups.values()].sort(
    (a, b) => Math.abs(b.total) - Math.abs(a.total) || a.merchantDisplay.localeCompare(b.merchantDisplay, 'sv'),
  );
}
