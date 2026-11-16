import { addDays, isoDate } from './dates.ts';
import { lastBankingDayOnOrBefore } from './holidays.ts';

/**
 * Budget periods that run from payday to payday (docs/SPEC.md §9).
 */

export interface PeriodSettings {
  /** Day of the month a period starts on, 1–28. 1 = plain calendar months. */
  startDay: number;
  /** Move the start back to the last Swedish banking day on or before `startDay`. */
  adjustToBankingDay: boolean;
}

/** Swedish payday: the 25th, moved back to the previous banking day if needed. */
export const DEFAULT_PERIOD_SETTINGS: PeriodSettings = { startDay: 25, adjustToBankingDay: true };

function assertValidStartDay(startDay: number): void {
  if (!Number.isInteger(startDay) || startDay < 1 || startDay > 28) {
    throw new RangeError(`Period start day must be an integer from 1 to 28, got ${startDay}`);
  }
}

/**
 * The date a period starts in the given calendar month.
 *
 * With the defaults that's Swedish payday: Oct 2026 → Fri Oct 23 (the 25th is a Sunday),
 * Dec 2026 → Wed Dec 23 (Julafton and Juldagen).
 *
 * Start day 1 always gives the 1st, so periods are exact calendar months.
 */
export function payday(year: number, month: number, settings: PeriodSettings = DEFAULT_PERIOD_SETTINGS): string {
  assertValidStartDay(settings.startDay);
  const nominal = isoDate(year, month, settings.startDay);
  if (!nominal) throw new RangeError(`Invalid month: ${year}-${month}`);
  if (settings.startDay === 1 || !settings.adjustToBankingDay) return nominal;
  return lastBankingDayOnOrBefore(nominal);
}

/** A period label, `YYYY-MM`: the month the period mostly falls in. */
export type PeriodLabel = string;

export interface Period {
  label: PeriodLabel;
  /** First day, inclusive (ISO date). */
  start: string;
  /** Last day, inclusive (ISO date). */
  end: string;
}

const LABEL = /^(\d{4})-(0[1-9]|1[0-2])$/;

function parseLabel(label: PeriodLabel): { year: number; month: number } {
  const m = LABEL.exec(label);
  if (!m) throw new RangeError(`Invalid period label: "${label}"`);
  return { year: Number(m[1]), month: Number(m[2]) };
}

function toLabel(year: number, month: number): PeriodLabel {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** The label `n` periods after `label` (negative = before). */
export function shiftPeriod(label: PeriodLabel, n: number): PeriodLabel {
  const { year, month } = parseLabel(label);
  const index = year * 12 + (month - 1) + n;
  return toLabel(Math.floor(index / 12), (index % 12) + 1);
}

/**
 * A period is labelled by the month it mostly falls in. Starting on day 16–28 means most of it
 * lies in the following month (Nov 25 – Dec 22 → "2026-12"); starting on day 1–15 means most of
 * it lies in the month it starts in (Nov 1 – Nov 30 → "2026-11").
 *
 * The cutoff has to be fixed per start day (not computed per month) so every period gets exactly
 * one label. For mid-month start days the period splits roughly in half and the label is a
 * convention; for the 25th and the 1st the label month always holds most of the period.
 */
function labelOffset(settings: PeriodSettings): number {
  return settings.startDay > 15 ? 1 : 0;
}

/** Start and end dates of the period with this label. */
export function periodRange(label: PeriodLabel, settings: PeriodSettings = DEFAULT_PERIOD_SETTINGS): Period {
  const startMonth = shiftPeriod(label, -labelOffset(settings));
  const nextStartMonth = shiftPeriod(startMonth, 1);
  const s = parseLabel(startMonth);
  const n = parseLabel(nextStartMonth);
  return {
    label,
    start: payday(s.year, s.month, settings),
    end: addDays(payday(n.year, n.month, settings), -1),
  };
}

/** The label of the period that contains `date` (ISO). */
export function periodOf(date: string, settings: PeriodSettings = DEFAULT_PERIOD_SETTINGS): PeriodLabel {
  // Guess from the calendar month, then step until the range contains the date. Banking-day
  // adjustment moves starts back by at most a few days, so this takes at most one step.
  let label = shiftPeriod(date.slice(0, 7), labelOffset(settings));
  for (;;) {
    const range = periodRange(label, settings);
    if (date < range.start) label = shiftPeriod(label, -1);
    else if (date > range.end) label = shiftPeriod(label, 1);
    else return label;
  }
}
