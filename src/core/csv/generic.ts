import Papa from 'papaparse';
import { COUNTRIES } from '../country/index.ts';
import { parseAmount, type Ore } from '../money.ts';
import { parseDateAs } from './date-formats.ts';
import { headerSignature, type CsvMapping } from './mapping.ts';
import type { ParsedRow, ParseResult, RowError } from './types.ts';

/**
 * Parses any CSV with a saved mapping (docs/SPEC.md §4.2): same contract as the bank presets —
 * rows in file order, every text field scrubbed of national ID numbers, bad lines reported (with
 * line numbers) and skipped, never half-imported.
 */

const BOM = '﻿';

function scrub(text: string): string {
  return Object.values(COUNTRIES).reduce((acc, country) => country.redactPersonalIds(acc), text);
}

/** True if `text`'s header row is the layout this mapping was made for. */
export function matchesMapping(text: string, mapping: Pick<CsvMapping, 'delimiter' | 'headerSignature'>): boolean {
  const clean = text.startsWith(BOM) ? text.slice(1) : text;
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? '';
  const [header = []] = Papa.parse<string[]>(firstLine, { delimiter: mapping.delimiter }).data;
  return header.length > 0 && headerSignature(header, mapping.delimiter) === mapping.headerSignature;
}

export function parseWithMapping(text: string, mapping: CsvMapping): ParseResult {
  const clean = text.startsWith(BOM) ? text.slice(1) : text;
  const { data } = Papa.parse<string[]>(clean, { delimiter: mapping.delimiter, skipEmptyLines: false });
  const { columns, decimal, dateFormat } = mapping;
  const cell = (cells: string[], i: number | undefined) => (i === undefined ? '' : (cells[i] ?? '').trim());
  const amountOf = (value: string, what: string): Ore => {
    try {
      return parseAmount(value, { decimal });
    } catch {
      throw new Error(`Invalid ${what}: "${value}"`);
    }
  };

  const rows: ParsedRow[] = [];
  const errors: RowError[] = [];

  data.slice(1).forEach((cells, i) => {
    const line = i + 2;
    if (cells.every((c) => c.trim() === '')) return;
    try {
      const rawDate = cell(cells, columns.date);
      const bookingDate = parseDateAs(rawDate, dateFormat);
      if (!bookingDate) throw new Error(`Invalid date: "${rawDate}" (expected ${dateFormat})`);

      let amount: Ore;
      if (columns.amount !== undefined) {
        amount = amountOf(cell(cells, columns.amount), 'amount');
      } else {
        const debit = cell(cells, columns.debit);
        const credit = cell(cells, columns.credit);
        if (!debit && !credit) throw new Error('Missing amount (both debit and credit are empty)');
        // Banks write debits as positive or negative numbers; either way it's money out.
        amount = (credit ? amountOf(credit, 'credit') : 0) - Math.abs(debit ? amountOf(debit, 'debit') : 0);
      }

      const description = scrub(
        columns.description
          .map((c) => cell(cells, c))
          .filter(Boolean)
          .join(' '),
      );
      if (!description) throw new Error('Missing description');

      const balanceText = cell(cells, columns.balance);
      rows.push({
        line,
        bookingDate,
        amount,
        description,
        ...(balanceText ? { balance: amountOf(balanceText, 'balance') } : {}),
        currency: 'SEK',
      });
    } catch (err) {
      errors.push({ line, message: err instanceof Error ? err.message : String(err) });
    }
  });

  return { rows, errors };
}
