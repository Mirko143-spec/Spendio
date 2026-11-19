import { matchesMapping, parseWithMapping } from '../../csv/generic.ts';
import { headerSignature, type CsvMapping } from '../../csv/mapping.ts';
import type { BankFormat } from '../types.ts';
import { describeTransaction } from './describe.ts';

/**
 * Nordea's PDF transaction list ("Kontohändelser"), once read into a table (core/pdf/table.ts):
 *
 *   Datum;Namn;Belopp;Saldo
 *
 * Dates `YYYY-MM-DD`, decimal comma, space as thousands separator. "Namn" holds the same text as
 * the CSV export's "Rubrik", so Nordea's description reader applies unchanged.
 */
const MAPPING: CsvMapping = {
  id: 'preset:nordea-pdf',
  headerSignature: headerSignature(['Datum', 'Namn', 'Belopp', 'Saldo'], ';'),
  name: 'Nordea',
  delimiter: ';',
  dateFormat: 'YYYY-MM-DD',
  decimal: ',',
  columns: { date: 0, description: [1], amount: 2, balance: 3 },
  createdAt: '2026-01-01T00:00:00.000Z',
};

/**
 * Same `id` as the CSV preset: both are the same Nordea account, so a transaction imported from
 * a PDF and again from a CSV (same date, amount, text and balance) is recognized as a duplicate.
 */
export const NORDEA_PDF: BankFormat = {
  id: 'nordea',
  name: 'Nordea',
  country: 'SE',
  detect: (text) => matchesMapping(text, MAPPING),
  parse: (text) => parseWithMapping(text, MAPPING),
  describe: describeTransaction,
};
