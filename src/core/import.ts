import { accountForFormat, type Account } from './account.ts';
import { categorize, type CategorySource } from './categorize.ts';
import { countryFor } from './country/index.ts';
import type { RowError } from './csv/types.ts';
import { dedupRows } from './dedup.ts';
import { BANK_FORMATS, detectFormat } from './formats/index.ts';
import type { BankFormat, TransactionKind } from './formats/types.ts';
import { cleanMerchant } from './merchant.ts';
import type { Ore } from './money.ts';
import type { Rule } from './rules.ts';

/**
 * The bank-neutral import pipeline (docs/SPEC.md §8): detect format → parse (and scrub) →
 * dedup → describe → clean merchant → categorize. Pure: ids and the clock are passed in, and
 * nothing is stored here.
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
  /** Bank name and date, e.g. "Nordea · 2026-11-16". Never the file name, which can contain a personnummer. */
  label: string;
  importedAt: string;
  rowCount: number;
  newCount: number;
  duplicateCount: number;
  errorCount: number;
}

export interface ImportOptions {
  existingFingerprints: ReadonlySet<string>;
  userRules?: readonly Rule[];
  /** ISO timestamp of the import. */
  now: string;
  newId: () => string;
  /** Formats to try, in order. Defaults to every built-in preset. */
  formats?: readonly BankFormat[];
}

export interface ImportResult {
  /** The bank format that recognized the file. */
  format: Pick<BankFormat, 'id' | 'name' | 'country'>;
  /** The account the transactions belong to; the caller creates it if it doesn't exist yet. */
  account: Account;
  batch: ImportBatch;
  /** New transactions only, in file order. */
  transactions: Transaction[];
  errors: RowError[];
}

/** Thrown when no bank format recognizes the file (the UI then offers the generic mapper). */
export class UnsupportedFormatError extends Error {
  override name = 'UnsupportedFormatError';
  constructor() {
    super('This file is not in a supported bank format.');
  }
}

export function importCsv(text: string, options: ImportOptions): ImportResult {
  const { existingFingerprints, userRules = [], now, newId, formats = BANK_FORMATS } = options;
  const format = detectFormat(text, formats);
  if (!format) throw new UnsupportedFormatError();
  const country = countryFor(format.country);
  const account = accountForFormat(format);
  const accountId = account.id;
  const { rows, errors } = format.parse(text);
  const { fresh, duplicateCount } = dedupRows(accountId, rows, existingFingerprints);
  const batchId = newId();

  const transactions = fresh.map((row): Transaction => {
    const described = format.describe(row.description, row.bookingDate);
    const merchant = cleanMerchant(described.counterparty);
    const category = categorize({ kind: described.kind, merchantKey: merchant.key }, userRules, country);
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
    format: { id: format.id, name: format.name, country: format.country },
    account,
    batch: {
      id: batchId,
      accountId,
      label: `${format.name} · ${now.slice(0, 10)}`,
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
