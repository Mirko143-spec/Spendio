import Papa from 'papaparse';
import { COUNTRIES } from '../country/index.ts';
import { parseAmount } from '../money.ts';
import { parseDateAs } from './date-formats.ts';
import { DATE_FORMATS, headerSignature, type ColumnMap, type DateFormat, type Delimiter } from './mapping.ts';

/**
 * Reads an unknown CSV just enough to set up a mapping (docs/SPEC.md §4.2): the delimiter, the
 * header row, sample rows, and a best guess for every setting. Guesses come from what the values
 * look like; header names are only hints. The person confirms or corrects them in the mapper.
 */

export interface CsvSample {
  delimiter: Delimiter;
  header: string[];
  /** Data rows, all padded or cut to the header's length. */
  rows: string[][];
  signature: string;
}

export interface MappingGuess {
  dateFormat: DateFormat;
  decimal: ',' | '.';
  /** Partial when a role couldn't be guessed (e.g. no date column found). */
  columns: Partial<ColumnMap>;
}

const DELIMITERS: readonly Delimiter[] = [';', ',', '\t', '|'];
const BOM = '﻿';

function parseRows(text: string, delimiter: Delimiter): string[][] {
  return Papa.parse<string[]>(text, { delimiter, skipEmptyLines: true }).data;
}

/** The delimiter that splits the first lines into the same number (> 1) of columns most consistently. */
function detectDelimiter(text: string): Delimiter {
  const head = text.split(/\r?\n/).slice(0, 10).join('\n');
  let best: Delimiter = ',';
  let bestScore = 0;
  for (const d of DELIMITERS) {
    const counts = parseRows(head, d).map((r) => r.length);
    if (counts.length === 0 || counts[0]! < 2) continue;
    const consistent = counts.filter((c) => c === counts[0]).length;
    const score = consistent * counts[0]!;
    if (score > bestScore) [best, bestScore] = [d, score];
  }
  return best;
}

export function sniffCsv(text: string): CsvSample {
  const clean = text.startsWith(BOM) ? text.slice(1) : text;
  const delimiter = detectDelimiter(clean);
  const [header = [], ...data] = parseRows(clean, delimiter);
  const width = header.length;
  const rows = data
    .filter((r) => r.some((c) => c.trim() !== ''))
    .map((r) => Array.from({ length: width }, (_, i) => (r[i] ?? '').trim()));
  return { delimiter, header: header.map((h) => h.trim()), rows, signature: headerSignature(header, delimiter) };
}

const values = (sample: CsvSample, column: number) =>
  sample.rows.map((r) => r[column] ?? '').filter((v) => v !== '');

function dateFormatFor(vals: readonly string[]): DateFormat | undefined {
  if (vals.length === 0) return undefined;
  // DATE_FORMATS lists day-first before month-first, so ambiguous dates read the Swedish way.
  return DATE_FORMATS.find((f) => vals.every((v) => parseDateAs(v, f)));
}

function decimalFor(sample: CsvSample): ',' | '.' {
  let comma = 0;
  let dot = 0;
  for (const row of sample.rows) {
    for (const v of row) {
      if (/^[+−-]?[\d .\u00A0]*\d,\d{1,2}$/.test(v)) comma++;
      else if (/^[+−-]?[\d ,\u00A0]*\d\.\d{1,2}$/.test(v)) dot++;
    }
  }
  return comma > dot ? ',' : '.';
}

const isNumeric = (vals: readonly string[], decimal: ',' | '.') =>
  vals.length > 0 &&
  vals.every((v) => {
    try {
      parseAmount(v, { decimal });
      return true;
    } catch {
      return false;
    }
  });

/** Description header hints, strongest first. (No "mottagare": in some exports it holds ID numbers.) */
const DESCRIPTION_HINTS = [/^(text|rubrik|beskrivning|description)$/i, /(text|rubrik|beskrivning|description)/i, /(meddelande|specifikation|transaktion)/i];

/** True if most values contain a national ID number (e.g. a personnummer column) — never suggest it as text. */
function looksLikeIdColumn(vals: readonly string[]): boolean {
  const withIds = vals.filter((v) => Object.values(COUNTRIES).some((c) => c.redactPersonalIds(v) !== v)).length;
  return vals.length > 0 && withIds * 2 > vals.length;
}

const HINTS = {
  amount: /^(belopp|amount|summa|sum|transaktionsbelopp)$/i,
  debit: /(debet|debit|uttag|out|utgift)/i,
  credit: /(kredit|credit|insättning|in$|inkomst)/i,
  balance: /(saldo|balance|behållning)/i,
};

export function guessMapping(sample: CsvSample): MappingGuess {
  const decimal = decimalFor(sample);
  const columns: Partial<ColumnMap> = {};
  const indexes = sample.header.map((_, i) => i);
  const byHeader = (re: RegExp, among: number[]) => among.find((i) => re.test(sample.header[i] ?? ''));

  // Date: the first column whose values all read as dates in one format.
  let dateFormat: DateFormat = 'YYYY-MM-DD';
  for (const i of indexes) {
    const f = dateFormatFor(values(sample, i));
    if (f) {
      columns.date = i;
      dateFormat = f;
      break;
    }
  }

  // Money: columns whose values all read as amounts (and aren't the date column).
  const numeric = indexes.filter((i) => i !== columns.date && isNumeric(values(sample, i), decimal));
  const balance = byHeader(HINTS.balance, numeric);
  if (balance !== undefined) columns.balance = balance;
  const money = numeric.filter((i) => i !== balance);
  const debit = byHeader(HINTS.debit, money);
  const credit = byHeader(HINTS.credit, money);
  if (debit !== undefined && credit !== undefined && debit !== credit) {
    columns.debit = debit;
    columns.credit = credit;
  } else {
    const amount = byHeader(HINTS.amount, money) ?? money[0];
    if (amount !== undefined) columns.amount = amount;
    // Without a header hint, a remaining numeric column after the amount is most likely the balance.
    if (balance === undefined) {
      const rest = money.filter((i) => i !== amount);
      if (rest.length === 1) columns.balance = rest[0];
    }
  }

  // Description: a text column, preferring a hinted header, else the one with the longest values.
  const used = new Set([columns.date, columns.amount, columns.debit, columns.credit, columns.balance]);
  const text = indexes.filter(
    (i) =>
      !used.has(i) &&
      values(sample, i).length > 0 &&
      !isNumeric(values(sample, i), decimal) &&
      !looksLikeIdColumn(values(sample, i)),
  );
  const avgLength = (i: number) => {
    const vals = values(sample, i);
    return vals.reduce((n, v) => n + v.length, 0) / (vals.length || 1);
  };
  const hinted = DESCRIPTION_HINTS.map((re) => byHeader(re, text)).find((i) => i !== undefined);
  const description = hinted ?? [...text].sort((a, b) => avgLength(b) - avgLength(a))[0];
  if (description !== undefined) columns.description = [description];

  return { dateFormat, decimal, columns };
}
