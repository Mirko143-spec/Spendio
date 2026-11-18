import { DEFAULT_COUNTRY } from '../core/country/index.ts';
import { tidyPersonName } from '../core/names.ts';
import type { ReviewGroup } from '../core/review.ts';

/** Amount split for display: sign, number and currency, e.g. ["+", "1 500,00", "kr"]. */
export function amountParts(ore: number): { sign: '+' | '−' | ''; number: string; currency: string } {
  const formatter = new Intl.NumberFormat(DEFAULT_COUNTRY.locale, {
    style: 'currency',
    currency: DEFAULT_COUNTRY.currency,
  });
  const parts = formatter.formatToParts(Math.abs(ore) / 100);
  const number = parts
    .filter((p) => p.type !== 'currency' && p.type !== 'literal' && p.type !== 'minusSign')
    .map((p) => p.value)
    .join('');
  const currency = parts.find((p) => p.type === 'currency')?.value ?? DEFAULT_COUNTRY.currency;
  return { sign: ore > 0 ? '+' : ore < 0 ? '−' : '', number, currency };
}

const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: 'UTC' });
const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** "27 Oct", "3–10 Nov", "25 Oct – 9 Nov". */
export function dateRange(first: string, last: string): string {
  if (first === last) return dayMonth.format(toDate(first));
  if (first.slice(0, 7) === last.slice(0, 7)) return `${day.format(toDate(first))}–${dayMonth.format(toDate(last))}`;
  return `${dayMonth.format(toDate(first))} – ${dayMonth.format(toDate(last))}`;
}

/** How a review group is named for the person reading it. */
export function groupTitle(group: Pick<ReviewGroup, 'kind' | 'merchantDisplay'> & { isPerson?: boolean }): string {
  const name = group.isPerson ? tidyPersonName(group.merchantDisplay) : group.merchantDisplay;
  switch (group.kind) {
    case 'swish_out':
      return `Swish to ${name}`;
    case 'swish_in':
      return `Swish from ${name}`;
    case 'swish_refund':
      return `Swish refund from ${name}`;
    case 'autogiro':
      return `Direct debit to ${group.merchantDisplay}`;
    default:
      return group.merchantDisplay;
  }
}

const NOUNS: Partial<Record<ReviewGroup['kind'], [string, string]>> = {
  card: ['purchase', 'purchases'],
  swish_out: ['payment', 'payments'],
  swish_in: ['payment', 'payments'],
  swish_refund: ['refund', 'refunds'],
  autogiro: ['payment', 'payments'],
  deposit: ['deposit', 'deposits'],
};

/** "6 purchases, 3–10 Nov" */
export function groupContext(group: Pick<ReviewGroup, 'kind' | 'transactionIds' | 'firstDate' | 'lastDate'>): string {
  const [one, many] = NOUNS[group.kind] ?? ['transaction', 'transactions'];
  const n = group.transactionIds.length;
  return `${n} ${n === 1 ? one : many}, ${dateRange(group.firstDate, group.lastDate)}`;
}

/** "Nordea", "Nordea and SEB", "Nordea, SEB and Swedbank". */
export function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

const monthLong = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const monthShort = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' });

/** "2026-11" → "November 2026" (or "Nov" when short). */
export function periodName(label: string, short = false): string {
  const date = new Date(`${label}-01T00:00:00Z`);
  return (short ? monthShort : monthLong).format(date);
}

/** Whole currency amount in the country's format, e.g. 1200000 öre → "12 000 kr". */
export function wholeAmount(ore: number): string {
  return new Intl.NumberFormat(DEFAULT_COUNTRY.locale, {
    style: 'currency',
    currency: DEFAULT_COUNTRY.currency,
    maximumFractionDigits: 0,
  }).format(Math.round(ore / 100));
}

/** Plain-language names for transaction kinds (filters, details). */
export const KIND_LABELS: Record<ReviewGroup['kind'], string> = {
  card: 'Card purchases',
  swish_out: 'Swish payments sent',
  swish_in: 'Swish payments received',
  swish_refund: 'Swish refunds',
  autogiro: 'Direct debits',
  deposit: 'Deposits',
  other: 'Other',
};
