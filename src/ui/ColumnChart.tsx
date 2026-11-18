import { useState } from 'react';
import type { Period } from '../core/periods.ts';
import { dateRange, periodName, wholeAmount } from './format.ts';

export interface ColumnDatum {
  period: Period;
  /** In öre; may be negative (drawn below the zero line). */
  value: number;
}

const HEIGHT = 160; // px of plot area, split between above and below zero
const LABEL_ROOM = 20; // px kept free for a value label at a column's end

/**
 * Columns per period around a zero baseline (dataviz: change over time with polarity → columns,
 * positive in --chart-mark, negative in --chart-negative; a validated pair). Every column carries its
 * value as text, sits on a hairline baseline, and shows its period's dates on hover and focus.
 */
export function ColumnChart({ title, data }: { title: string; data: readonly ColumnDatum[] }) {
  const [active, setActive] = useState<string | null>(null);
  const maxUp = Math.max(0, ...data.map((d) => d.value));
  const maxDown = Math.max(0, ...data.map((d) => -d.value));
  // Room for a value label on each side that has columns, so a short column's label never runs
  // into the baseline or the month name. One scale for both sides keeps the columns comparable.
  const roomUp = maxUp > 0 ? LABEL_ROOM : 0;
  const roomDown = maxDown > 0 ? LABEL_ROOM : 0;
  const scale = (HEIGHT - roomUp - roomDown) / (maxUp + maxDown || 1);
  const upHeight = maxUp * scale + roomUp;
  const downHeight = maxDown * scale + roomDown;

  return (
    <figure>
      <figcaption className="font-semibold">{title}</figcaption>
      <ul aria-label={title} className="mt-8 grid" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
        {data.map((d) => {
          const label = d.period.label;
          const height = Math.round(Math.abs(d.value) * scale);
          const negative = d.value < 0;
          return (
            <li
              key={label}
              tabIndex={0}
              aria-label={`${periodName(label)}: ${wholeAmount(d.value)}`}
              onPointerEnter={() => setActive(label)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(label)}
              onBlur={() => setActive(null)}
              className="relative flex flex-col items-center rounded-md"
            >
              {/* Above zero: value label on the cap, column growing up from the baseline. */}
              <div aria-hidden="true" className="flex w-full flex-col items-center justify-end" style={{ height: upHeight }}>
                {!negative && (
                  <>
                    {d.value !== 0 && <span className="mb-1 text-xs font-semibold whitespace-nowrap">{wholeAmount(d.value)}</span>}
                    {d.value > 0 && (
                      <span data-sign="positive" className="w-full max-w-6 rounded-t-[4px] bg-chart-mark" style={{ height }} />
                    )}
                  </>
                )}
              </div>
              <div aria-hidden="true" className="h-px w-full bg-ink-muted/40" />
              {/* Below zero: column hanging from the baseline, value label under it. */}
              <div aria-hidden="true" className="flex w-full flex-col items-center" style={{ height: downHeight }}>
                {negative && (
                  <>
                    <span data-sign="negative" className="w-full max-w-6 rounded-b-[4px] bg-chart-negative" style={{ height }} />
                    <span className="mt-1 text-xs font-semibold whitespace-nowrap">{wholeAmount(d.value)}</span>
                  </>
                )}
              </div>
              <span aria-hidden="true" className="mt-2 text-xs text-ink-muted">
                {periodName(label, true)}
              </span>
              {active === label && (
                <span
                  role="tooltip"
                  className="absolute -top-8 z-10 rounded-md border border-line bg-surface-raised px-2.5 py-1 text-xs whitespace-nowrap shadow-sm"
                >
                  <strong className="font-semibold">{wholeAmount(d.value)}</strong>{' '}
                  <span className="text-ink-muted">{dateRange(d.period.start, d.period.end)}</span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </figure>
  );
}
