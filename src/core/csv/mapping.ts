/**
 * A saved column mapping for a CSV layout no bank preset recognizes (docs/SPEC.md §4.2).
 * Each mapping becomes its own bank format, keyed by the file's header row, so the next file
 * with the same layout imports in one click.
 */

export type DateFormat = 'YYYY-MM-DD' | 'YYYY/MM/DD' | 'YYYYMMDD' | 'DD/MM/YYYY' | 'DD.MM.YYYY' | 'DD-MM-YYYY' | 'MM/DD/YYYY';

export const DATE_FORMATS: readonly DateFormat[] = [
  'YYYY-MM-DD',
  'YYYY/MM/DD',
  'YYYYMMDD',
  'DD/MM/YYYY',
  'DD.MM.YYYY',
  'DD-MM-YYYY',
  'MM/DD/YYYY',
];

export type Delimiter = ',' | ';' | '\t' | '|';

/** Column indexes (0-based) in the file. Amount is either one signed column or debit + credit. */
export interface ColumnMap {
  date: number;
  amount?: number;
  /** Money out; read as a positive or negative number, always stored as money out. */
  debit?: number;
  /** Money in. */
  credit?: number;
  /** One or more text columns, joined with a space. */
  description: number[];
  balance?: number;
}

export interface CsvMapping {
  id: string;
  /** Normalized header row the mapping applies to (see `headerSignature`). */
  headerSignature: string;
  /** Bank name the person gave, shown on accounts and imports (e.g. "SEB"). */
  name: string;
  delimiter: Delimiter;
  dateFormat: DateFormat;
  decimal: ',' | '.';
  columns: ColumnMap;
  createdAt: string;
}

/** A layout's identity: its header cells, trimmed and lowercased, joined by the delimiter. */
export function headerSignature(cells: readonly string[], delimiter: Delimiter): string {
  return cells.map((c) => c.trim().toLowerCase()).join(delimiter);
}
