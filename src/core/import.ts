import { categorize, type CategorySource } from './categorize.ts';
import { parseNordeaCsv } from './formats/nordea/parse.ts';
import type { RowError } from './csv/types.ts';
import { dedupRows } from './dedup.ts';
import { describeTransaction } from './formats/nordea/describe.ts';
import type { TransactionKind } from './formats/types.ts';
import { cleanMerchant } from './merchant.ts';
import type { Ore } from './money.ts';
import type { Rule } from './rules.ts';

/**
 * The import pipeline (docs/SPEC.md §8): parse → scrub → dedup → describe → clean merchant →
 * categorize. Pure: ids and the clock are passed in, and nothing is stored here.
 */

export interface Transaction {
  id: string;
  accountId: string;
  importBatchId: string;
  fingerprint: string;
  /** ISO dates. */
  bookingDate: string;
  purchaseDate?: string;
  effectiveDate: string;
  amount: Ore;
  balance?: Ore;
  currency: 'SEK';
  /** Scrubbed bank description. */
  description: string;
  kind: TransactionKind;
  merchantKey: string;
  merchantDisplay: string;
  counterpartyIsPerson?: boolean;
  /** null = Needs review. */
  categoryId: string | null;
  categorySource: CategorySource;
  /** Categorized by a guess the review screen should still show. */
  suggested: boolean;
}

export interface ImportBatch {
  id: string;
  accountId: string;
  /** E.g. "Nordea · 2026-11-16". Never the file name, which can contain a personnummer. */
  label: string;
  importedAt: string;
  rowCount: number;
  newCount: number;
  duplicateCount: number;
  errorCount: number;
}

export interface ImportOptions {
  accountId: string;
  existingFingerprints: ReadonlySet<string>;
  userRules?: readonly Rule[];
  /** ISO timestamp of the import. */
  now: string;
  newId: () => string;
}

export interface ImportResult {
  batch: ImportBatch;
  /** New transactions only, in file order. */
  transactions: Transaction[];
  errors: RowError[];
}

export function importNordeaCsv(text: string, options: ImportOptions): ImportResult {
  const { accountId, existingFingerprints, userRules = [], now, newId } = options;
  const { rows, errors } = parseNordeaCsv(text);
  const { fresh, duplicateCount } = dedupRows(accountId, rows, existingFingerprints);
  const batchId = newId();

  const transactions = fresh.map((row): Transaction => {
    const described = describeTransaction(row.description, row.bookingDate);
    const merchant = cleanMerchant(described.counterparty);
    const category = categorize({ kind: described.kind, merchantKey: merchant.key }, userRules);
    return {
      id: newId(),
      accountId,
      importBatchId: batchId,
      fingerprint: row.fingerprint,
      bookingDate: row.bookingDate,
      ...(described.purchaseDate ? { purchaseDate: described.purchaseDate } : {}),
      effectiveDate: described.effectiveDate,
      amount: row.amount,
      ...(row.balance !== undefined ? { balance: row.balance } : {}),
      currency: row.currency,
      description: row.description,
      kind: described.kind,
      merchantKey: merchant.key,
      merchantDisplay: merchant.display,
      ...(category.counterpartyIsPerson !== undefined ? { counterpartyIsPerson: category.counterpartyIsPerson } : {}),
      categoryId: category.categoryId,
      categorySource: category.source,
      suggested: category.suggested,
    };
  });

  return {
    batch: {
      id: batchId,
      accountId,
      label: `Nordea · ${now.slice(0, 10)}`,
      importedAt: now,
      rowCount: rows.length + errors.length,
      newCount: transactions.length,
      duplicateCount,
      errorCount: errors.length,
    },
    transactions,
    errors,
  };
}
