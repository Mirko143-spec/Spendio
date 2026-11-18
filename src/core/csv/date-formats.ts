import { isoDate } from '../dates.ts';
import type { DateFormat } from './mapping.ts';

const PATTERNS: Record<DateFormat, { re: RegExp; order: ['y' | 'm' | 'd', 'y' | 'm' | 'd', 'y' | 'm' | 'd'] }> = {
  'YYYY-MM-DD': { re: /^(\d{4})-(\d{1,2})-(\d{1,2})$/, order: ['y', 'm', 'd'] },
  'YYYY/MM/DD': { re: /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/, order: ['y', 'm', 'd'] },
  YYYYMMDD: { re: /^(\d{4})(\d{2})(\d{2})$/, order: ['y', 'm', 'd'] },
  'DD/MM/YYYY': { re: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, order: ['d', 'm', 'y'] },
  'DD.MM.YYYY': { re: /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/, order: ['d', 'm', 'y'] },
  'DD-MM-YYYY': { re: /^(\d{1,2})-(\d{1,2})-(\d{4})$/, order: ['d', 'm', 'y'] },
  'MM/DD/YYYY': { re: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, order: ['m', 'd', 'y'] },
};

/** Reads a date in `format` as ISO `YYYY-MM-DD`, or undefined if it doesn't fit or doesn't exist. */
export function parseDateAs(value: string, format: DateFormat): string | undefined {
  const { re, order } = PATTERNS[format];
  const m = re.exec(value.trim());
  if (!m) return undefined;
  const parts = { y: 0, m: 0, d: 0 };
  order.forEach((key, i) => (parts[key] = Number(m[i + 1])));
  return isoDate(parts.y, parts.m, parts.d);
}
