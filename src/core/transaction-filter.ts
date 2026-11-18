import type { TransactionKind } from './formats/types.ts';
import type { Transaction } from './import.ts';
import { tidyPersonName } from './names.ts';
import { DEFAULT_PERIOD_SETTINGS, periodRange, type PeriodLabel, type PeriodSettings } from './periods.ts';
import { needsReview } from './review.ts';

/**
 * Filtering for the Transactions page (docs/SPEC.md §12): period, category or Needs review,
 * transaction kind, and free-text search. Results are newest first.
 */

export interface TransactionFilter {
  /** A period label, or null for all periods. */
  period: PeriodLabel | null;
  /** A category id, `'needs-review'`, or null for all. */
  category: string | 'needs-review' | null;
  kind: TransactionKind | null;
  /** Matched case-insensitively against the merchant, the person's tidied name and the bank text. */
  query: string;
}

export const NO_FILTER: TransactionFilter = { period: null, category: null, kind: null, query: '' };

function searchText(t: Transaction): string {
  const person = t.counterpartyIsPerson ? ` ${tidyPersonName(t.merchantDisplay)}` : '';
  return `${t.merchantDisplay}${person} ${t.description}`.toLocaleLowerCase('sv-SE');
}

export function filterTransactions(
  transactions: readonly Transaction[],
  filter: TransactionFilter,
  settings: PeriodSettings = DEFAULT_PERIOD_SETTINGS,
): Transaction[] {
  const range = filter.period ? periodRange(filter.period, settings) : null;
  const words = filter.query.toLocaleLowerCase('sv-SE').split(/\s+/).filter(Boolean);

  return transactions
    .filter((t) => {
      if (range && (t.effectiveDate < range.start || t.effectiveDate > range.end)) return false;
      if (filter.category === 'needs-review') {
        if (!needsReview(t)) return false;
      } else if (filter.category !== null && t.categoryId !== filter.category) {
        return false;
      }
      if (filter.kind && t.kind !== filter.kind) return false;
      if (words.length > 0) {
        const text = searchText(t);
        if (!words.every((w) => text.includes(w))) return false;
      }
      return true;
    })
    .sort(
      (a, b) =>
        b.effectiveDate.localeCompare(a.effectiveDate) ||
        b.bookingDate.localeCompare(a.bookingDate) ||
        a.id.localeCompare(b.id),
    );
}
