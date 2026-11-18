import { DEFAULT_COUNTRY } from './country/index.ts';
import type { Country } from './country/types.ts';

/** Money amount in integer minor currency units (öre for SEK: 1 kr = 100 öre). Avoids floating-point errors. */
export type Ore = number;

export interface ParseAmountOptions {
  /** Decimal separator used in the source. Swedish bank exports use ','. */
  decimal?: ',' | '.';
}

// No-break and narrow no-break spaces (used as thousands separators by Intl/spreadsheets), normalized to ' '.
const SPACES = /[\u00A0\u202F]/g;
// Unicode minus sign, as produced by Intl/sv-SE formatting.
const UNICODE_MINUS = /\u2212/g;

// sign, integer part (plain digits, or 1–3 digits followed by groups of exactly 3), optional 1–2 decimals.
const COMMA_DECIMAL = /^([+-]?)(\d+|\d{1,3}(?:[ .]\d{3})+)(?:,(\d{1,2}))?$/;
const DOT_DECIMAL = /^([+-]?)(\d+|\d{1,3}(?:[ ,]\d{3})+)(?:\.(\d{1,2}))?$/;

/**
 * Parses a bank amount string into integer öre without going through floating point.
 *
 * parseAmount('-1 234,56') === -123456
 * parseAmount('13592,00') === 1359200
 * parseAmount('1,234.56', { decimal: '.' }) === 123456
 *
 * Throws on anything that isn't a plain amount (more than 2 decimals, letters, empty input).
 */
export function parseAmount(input: string, options: ParseAmountOptions = {}): Ore {
  const normalized = input.trim().replace(UNICODE_MINUS, '-').replace(SPACES, ' ');
  const pattern = (options.decimal ?? ',') === ',' ? COMMA_DECIMAL : DOT_DECIMAL;

  const parts = pattern.exec(normalized);
  if (!parts) throw new Error(`Invalid amount: "${input}"`);

  const [, sign, whole = '', fraction = ''] = parts;
  const ore = Number(whole.replace(/\D/g, '')) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(ore)) throw new Error(`Amount out of range: "${input}"`);
  return sign === '-' && ore !== 0 ? -ore : ore;
}

const formatters = new Map<string, Intl.NumberFormat>();

/**
 * Formats an amount in the country's currency and style. Sweden (default): 123456 → "1 234,56 kr"
 * (with no-break spaces).
 */
export function formatAmount(ore: Ore, country: Pick<Country, 'locale' | 'currency'> = DEFAULT_COUNTRY): string {
  const key = `${country.locale}|${country.currency}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(country.locale, { style: 'currency', currency: country.currency });
    formatters.set(key, formatter);
  }
  return formatter.format(ore / 100);
}
