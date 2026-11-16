import type { ParsedRow } from './csv/types.ts';

/**
 * Duplicate detection for re-imports and overlapping statements (docs/SPEC.md §8).
 *
 * Bank CSVs have no transaction IDs, so a row is identified by its content:
 * account + booking date + amount + description + balance. The running balance usually tells
 * identical-looking rows apart (two same-day purchases of the same amount). When a source has
 * no balance column, an occurrence index makes repeated rows within one file distinct:
 * a file with the same row 3 times yields `…#0`, `…#1`, `…#2`.
 *
 * This is multiset-aware by construction: if a file has n copies of a row and n − k are
 * already stored, exactly k are new.
 *
 * Fingerprints are the readable joined fields, not a hash: a hash collision would silently
 * drop a real transaction as a "duplicate".
 */

export interface FingerprintedRow extends ParsedRow {
  fingerprint: string;
}

export interface DedupResult {
  /** Rows not seen before, in file order, each with its fingerprint. */
  fresh: FingerprintedRow[];
  /** Number of rows skipped because they were already imported. */
  duplicateCount: number;
}

// ASCII unit separator: can't appear in CSV text fields after parsing.
const SEP = '\u001F';

function normalizeDescription(description: string): string {
  return description.trim().replace(/\s+/g, ' ');
}

function baseKey(accountId: string, row: ParsedRow): string {
  return [accountId, row.bookingDate, String(row.amount), normalizeDescription(row.description), row.balance ?? ''].join(SEP);
}

/** Fingerprints for `rows`, in the same order. Line numbers are deliberately not part of them. */
export function fingerprintRows(accountId: string, rows: readonly ParsedRow[]): FingerprintedRow[] {
  const seen = new Map<string, number>();
  return rows.map((row) => {
    const base = baseKey(accountId, row);
    const occurrence = seen.get(base) ?? 0;
    seen.set(base, occurrence + 1);
    return { ...row, fingerprint: `${base}${SEP}#${occurrence}` };
  });
}

/** Splits a parsed file into rows that are new and a count of rows already imported. */
export function dedupRows(
  accountId: string,
  rows: readonly ParsedRow[],
  existingFingerprints: ReadonlySet<string>,
): DedupResult {
  const fresh: FingerprintedRow[] = [];
  let duplicateCount = 0;
  for (const row of fingerprintRows(accountId, rows)) {
    if (existingFingerprints.has(row.fingerprint)) duplicateCount++;
    else fresh.push(row);
  }
  return { fresh, duplicateCount };
}
