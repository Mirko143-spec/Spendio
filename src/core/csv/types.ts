import type { Ore } from '../money.ts';

/** One statement row after parsing, before description parsing, dedup or categorization. */
export interface ParsedRow {
  /** 1-based line number in the source file (header = line 1). */
  line: number;
  /** Booking date, ISO `YYYY-MM-DD`. */
  bookingDate: string;
  amount: Ore;
  /** Free-text description, already scrubbed of personnummer. */
  description: string;
  /** Running balance after this transaction, if the source has one. */
  balance?: Ore;
  currency: 'SEK';
}

export interface RowError {
  line: number;
  message: string;
}

export interface ParseResult {
  /** Rows in file order (Nordea lists newest first). */
  rows: ParsedRow[];
  /** Lines that could not be parsed. They are skipped, never half-imported. */
  errors: RowError[];
}
