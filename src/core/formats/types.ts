import type { ParseResult } from '../csv/types.ts';
import type { Described } from '../describe.ts';

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
