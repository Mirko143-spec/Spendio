import type { PeriodBounds } from '../core/period-nav.ts';
import { shiftPeriod, type PeriodLabel } from '../core/periods.ts';
import { periodName } from './format.ts';
import { WINDOW } from './period-window.ts';
import { replaceParams } from './router.ts';

/** "‹ Earlier   June 2026 – November 2026   Later ›", kept in the URL. */
export function PeriodWindowNav({ end, bounds }: { end: PeriodLabel; bounds: Pick<PeriodBounds, 'first' | 'last'> }) {
  const start = shiftPeriod(end, -(WINDOW - 1));
  const button = 'rounded-lg px-2 py-1.5 text-sm font-medium text-ink-muted hover:text-ink disabled:invisible';
  return (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        className={button}
        disabled={start <= bounds.first}
        onClick={() => replaceParams({ end: shiftPeriod(end, -WINDOW) })}
      >
        ‹ Earlier
      </button>
      <h2 className="text-center font-semibold" aria-live="polite">
        {periodName(start)} – {periodName(end)}
      </h2>
      <button
        type="button"
        className={button}
        disabled={end >= bounds.last}
        // Stop at the last period with data, so the window never pages into empty months.
        onClick={() => {
          const later = shiftPeriod(end, WINDOW);
          replaceParams({ end: later < bounds.last ? later : bounds.last });
        }}
      >
        Later ›
      </button>
    </div>
  );
}
