import { DEFAULT_COUNTRY } from '../country/index.ts';
import { matchesMapping, parseWithMapping } from '../csv/generic.ts';
import type { CsvMapping } from '../csv/mapping.ts';
import { daysBetween, isoDate } from '../dates.ts';
import type { BankFormat, Described } from './types.ts';

/**
 * A saved CSV mapping as a bank format (docs/SPEC.md §4.2), so files with that layout import
 * like any preset. Descriptions are read bank-neutrally: leading date or reference tokens are
 * stripped so merchant rules can match, and a leading YYMMDD / YYYY-MM-DD that is a plausible
 * purchase date (0–30 days before booking) becomes the effective date.
 */

const MAX_BOOKING_DELAY_DAYS = 30;
const LEADING_DATE = /^(?:(\d{2})(\d{2})(\d{2})|(\d{4})-(\d{2})-(\d{2}))\s+/;
const LEADING_TOKEN = /^(?:\d{6}|\d{8}|\d{4}-\d{2}-\d{2}|\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?)\s+/;

export function describeGeneric(description: string, bookingDate: string): Described {
  let text = description.trim();
  let purchaseDate: string | undefined;

  const m = LEADING_DATE.exec(text);
  if (m) {
    const date = m[1] ? isoDate(2000 + Number(m[1]), Number(m[2]), Number(m[3])) : isoDate(Number(m[4]), Number(m[5]), Number(m[6]));
    if (date) {
      const delay = daysBetween(date, bookingDate);
      if (delay >= 0 && delay <= MAX_BOOKING_DELAY_DAYS) purchaseDate = date;
    }
  }
  while (LEADING_TOKEN.test(text)) text = text.replace(LEADING_TOKEN, '');

  return {
    kind: 'other',
    counterparty: text || description.trim(),
    ...(purchaseDate ? { purchaseDate } : {}),
    effectiveDate: purchaseDate ?? bookingDate,
  };
}

export function formatFromMapping(mapping: CsvMapping): BankFormat {
  return {
    id: `csv:${mapping.id}`,
    name: mapping.name,
    country: DEFAULT_COUNTRY.code,
    detect: (text) => matchesMapping(text, mapping),
    parse: (text) => parseWithMapping(text, mapping),
    describe: describeGeneric,
  };
}
