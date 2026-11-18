import { DEFAULT_PERIOD_SETTINGS, periodOf, type PeriodLabel, type PeriodSettings } from './periods.ts';

/**
 * Which periods the dashboard can move between, and which one it opens on.
 */

export interface PeriodBounds {
  /** Earliest period that can be shown. */
  first: PeriodLabel;
  /** Latest period that can be shown (today's period, or later data if any). */
  last: PeriodLabel;
  /** Where the dashboard opens: today's period if it has data, otherwise the latest period with data. */
  initial: PeriodLabel;
}

export function periodBounds(
  transactions: readonly { effectiveDate: string }[],
  today: string,
  settings: PeriodSettings = DEFAULT_PERIOD_SETTINGS,
): PeriodBounds {
  const current = periodOf(today, settings);
  const labels = new Set(transactions.map((t) => periodOf(t.effectiveDate, settings)));
  if (labels.size === 0) return { first: current, last: current, initial: current };

  const sorted = [...labels].sort();
  const earliest = sorted[0]!;
  const latest = sorted.at(-1)!;
  return {
    first: earliest < current ? earliest : current,
    last: latest > current ? latest : current,
    initial: labels.has(current) ? current : latest,
  };
}
