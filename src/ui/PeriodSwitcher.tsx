import type { PeriodBounds } from '../core/period-nav.ts';
import { shiftPeriod, type Period, type PeriodLabel } from '../core/periods.ts';
import { dateRange, periodName } from './format.ts';

interface PeriodSwitcherProps {
  period: Period;
  bounds: Pick<PeriodBounds, 'first' | 'last'>;
  onChange: (label: PeriodLabel) => void;
}

/** ‹ Oct   November 2026   Dec › with the period's real dates underneath (payday to payday). */
export function PeriodSwitcher({ period, bounds, onChange }: PeriodSwitcherProps) {
  const prev = shiftPeriod(period.label, -1);
  const next = shiftPeriod(period.label, 1);
  const button = 'rounded-lg px-2 py-1.5 text-sm font-medium text-ink-muted hover:text-ink disabled:invisible';

  return (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        className={button}
        disabled={prev < bounds.first}
        onClick={() => onChange(prev)}
        aria-label={`Previous period: ${periodName(prev)}`}
      >
        ‹ {periodName(prev, true)}
      </button>
      <div className="text-center">
        <h2 className="text-lg font-semibold" aria-live="polite">
          {periodName(period.label)}
        </h2>
        <p className="text-sm text-ink-muted">{dateRange(period.start, period.end)}</p>
      </div>
      <button
        type="button"
        className={button}
        disabled={next > bounds.last}
        onClick={() => onChange(next)}
        aria-label={`Next period: ${periodName(next)}`}
      >
        {periodName(next, true)} ›
      </button>
    </div>
  );
}
