import { isoDate } from './dates.ts';
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
