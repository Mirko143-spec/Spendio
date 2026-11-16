import { daysBetween, isoDate } from './dates.ts';

/**
 * Parses a Nordea `Rubrik` into what kind of transaction it is, who the counterparty is,
 * and which date it belongs to (docs/SPEC.md §5).
 */

export type TransactionKind = 'card' | 'swish_out' | 'swish_in' | 'swish_refund' | 'autogiro' | 'deposit' | 'other';

export interface Described {
  kind: TransactionKind;
  /** Counterparty text with the kind prefix (and card date) removed, before merchant cleanup. */
  counterparty: string;
  /** Purchase date from `Kortköp YYMMDD`, when present and plausible. */
  purchaseDate?: string;
  /** Date used for periods: purchase date if known, otherwise booking date. */
  effectiveDate: string;
}

/** A purchase date further back than this is treated as a misparse and ignored. */
const MAX_BOOKING_DELAY_DAYS = 30;

// Bank exports sometimes drop diacritics, so å/ä/ö also match a/o.
const CARD = /^Kortk[öo]p\s+(?:(\d{2})(\d{2})(\d{2})\s+)?(.*)$/i;
const PREFIXES: [RegExp, TransactionKind][] = [
  [/^Swish\s+betalning\s+(.*)$/i, 'swish_out'],
  [/^Swish\s+inbetalning\s+(.*)$/i, 'swish_in'],
  [/^Swish\s+[åa]terbetalning\s+(.*)$/i, 'swish_refund'],
  [/^Autogiro\s+(.*)$/i, 'autogiro'],
];
// "Insättningsautomat" (cash deposit machine) or "Insättning <reference>".
const DEPOSIT = /^(Ins[äa]ttning(?:sautomat)?)\b/i;

function parsePurchaseDate(yy: string, mm: string, dd: string, bookingDate: string): string | undefined {
  const date = isoDate(2000 + Number(yy), Number(mm), Number(dd));
  if (!date) return undefined;
  const delay = daysBetween(date, bookingDate);
  return delay >= 0 && delay <= MAX_BOOKING_DELAY_DAYS ? date : undefined;
}

export function describeTransaction(description: string, bookingDate: string): Described {
  const text = description.trim();

  const card = CARD.exec(text);
  if (card) {
    const [, yy, mm, dd, rest = ''] = card;
    const purchaseDate = yy && mm && dd ? parsePurchaseDate(yy, mm, dd, bookingDate) : undefined;
    return {
      kind: 'card',
      counterparty: rest.trim(),
      ...(purchaseDate ? { purchaseDate } : {}),
      effectiveDate: purchaseDate ?? bookingDate,
    };
  }

  for (const [pattern, kind] of PREFIXES) {
    const m = pattern.exec(text);
    if (m) return { kind, counterparty: (m[1] ?? '').trim(), effectiveDate: bookingDate };
  }

  const deposit = DEPOSIT.exec(text);
  if (deposit) return { kind: 'deposit', counterparty: deposit[1]!, effectiveDate: bookingDate };

  return { kind: 'other', counterparty: text, effectiveDate: bookingDate };
}
