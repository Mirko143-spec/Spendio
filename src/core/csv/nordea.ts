import Papa from 'papaparse';
import { parseAmount } from '../money.ts';
import { redactPersonnummer } from '../scrub.ts';
import type { ParsedRow, ParseResult, RowError } from './types.ts';

/**
 * Nordea (Sweden) CSV export, as described in docs/SPEC.md §4.1:
 *
 *   Bokföringsdag;Belopp;Avsändare;Mottagare;Namn;Rubrik;Saldo;Valuta;
 *
 * UTF-8 with BOM, `;`-delimited with a trailing `;`, dates `YYYY/MM/DD`, decimal comma.
 * `Avsändare` and `Mottagare` hold the account owner's personnummer: they are never read.
 */

const BOM = '﻿';
const DELIMITER = ';';

const COLUMNS = {
  date: 'Bokföringsdag',
  amount: 'Belopp',
  name: 'Namn',
  description: 'Rubrik',
  balance: 'Saldo',
  currency: 'Valuta',
} as const;
const REQUIRED = [COLUMNS.date, COLUMNS.amount, COLUMNS.description];

function stripBom(text: string): string {
  return text.startsWith(BOM) ? text.slice(1) : text;
}

function headerCells(text: string): string[] {
  const firstLine = stripBom(text).split(/\r?\n/, 1)[0] ?? '';
  return firstLine.split(DELIMITER).map((c) => c.trim());
}

/** True if the file looks like a Nordea export (based on the header row only). */
export function isNordeaCsv(text: string): boolean {
  const header = headerCells(text);
  return REQUIRED.every((col) => header.includes(col));
}

/** `2026/11/16` or `2026-11-16` → `2026-11-16`, rejecting impossible dates. */
function parseDate(value: string): string {
  const m = /^(\d{4})[/-](\d{2})[/-](\d{2})$/.exec(value.trim());
  if (m) {
    const [, y, mo, d] = m;
    const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
    if (date.getUTCMonth() === Number(mo) - 1 && date.getUTCDate() === Number(d)) return `${y}-${mo}-${d}`;
  }
  throw new Error(`Invalid date: "${value}"`);
}

export function parseNordeaCsv(text: string): ParseResult {
  if (!isNordeaCsv(text)) throw new Error('Not a Nordea CSV export');

  const { data } = Papa.parse<string[]>(stripBom(text), { delimiter: DELIMITER, skipEmptyLines: false });
  const [header = [], ...lines] = data;
  const index = (col: string) => header.findIndex((c) => c.trim() === col);
  const col = {
    date: index(COLUMNS.date),
    amount: index(COLUMNS.amount),
    name: index(COLUMNS.name),
    description: index(COLUMNS.description),
    balance: index(COLUMNS.balance),
    currency: index(COLUMNS.currency),
  };
  const cell = (cells: string[], i: number) => (i >= 0 ? (cells[i] ?? '').trim() : '');

  const rows: ParsedRow[] = [];
  const errors: RowError[] = [];

  lines.forEach((cells, i) => {
    const line = i + 2;
    if (cells.every((c) => c.trim() === '')) return;
    try {
      const currency = cell(cells, col.currency) || 'SEK';
      if (currency !== 'SEK') throw new Error(`Unsupported currency: "${currency}"`);

      const name = cell(cells, col.name);
      const rubrik = cell(cells, col.description);
      const description = redactPersonnummer(name ? `${rubrik} ${name}` : rubrik);
      if (!description) throw new Error('Missing description');

      const balance = cell(cells, col.balance);
      rows.push({
        line,
        bookingDate: parseDate(cell(cells, col.date)),
        amount: parseAmount(cell(cells, col.amount)),
        description,
        ...(balance ? { balance: parseAmount(balance) } : {}),
        currency: 'SEK',
      });
    } catch (err) {
      errors.push({ line, message: err instanceof Error ? err.message : String(err) });
    }
  });

  return { rows, errors };
}
