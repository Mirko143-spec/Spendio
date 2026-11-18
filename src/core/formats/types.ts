import type { ParseResult } from '../csv/types.ts';

/** What kind of transaction a row is. Banks word these differently; each format maps its own text. */
export type TransactionKind = 'card' | 'swish_out' | 'swish_in' | 'swish_refund' | 'autogiro' | 'deposit' | 'other';

/** A bank description, read by a `BankFormat`. */
export interface Described {
  kind: TransactionKind;
  /** Counterparty text with the bank's kind prefix (and any purchase date) removed, before merchant cleanup. */
  counterparty: string;
  /** Purchase date when the bank includes one and it is plausible. */
  purchaseDate?: string;
  /** Date used for periods: purchase date if known, otherwise booking date. */
  effectiveDate: string;
}

/**
 * A bank's statement export format. Each supported bank is one `BankFormat`; the import
 * pipeline is bank-neutral and picks whichever format recognizes the file.
 */
export interface BankFormat {
  /** Stable id, stored on accounts (e.g. "nordea"). */
  id: string;
  /** Display name (e.g. "Nordea"). */
  name: string;
  /** ISO 3166-1 alpha-2 country the bank's exports follow (e.g. "SE"). */
  country: string;
  /** True if `text` looks like this bank's export (checks the header only). */
  detect(text: string): boolean;
  /** Parses the file into rows; bad lines are reported, not thrown. */
  parse(text: string): ParseResult;
  /** Reads this bank's description text: transaction kind, counterparty and dates. */
  describe(description: string, bookingDate: string): Described;
}
