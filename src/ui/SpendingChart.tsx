import { useState } from 'react';
import type { DashboardModel } from '../core/dashboard.ts';
import { Amount } from './Amount.tsx';
import { wholeAmount } from './format.ts';
import { hrefFor } from './router.ts';

/**
 * Spending by category as ranked horizontal bars (dataviz: part-to-whole, compare parts → one hue,
 * largest first, value at the tip, no legend for a single series). Plain HTML so every label is
 * real text; each bar is a link to its transactions and shows its share on hover and focus.
 */
export function SpendingChart({ model }: { model: DashboardModel }) {
  const [active, setActive] = useState<string | null>(null);
  const rows = [...model.budgeted, ...model.unbudgeted].filter((r) => r.spent > 0).sort((a, b) => b.spent - a.spent);
  const total = rows.reduce((sum, r) => sum + r.spent, 0);
  const max = rows[0]?.spent ?? 0;
  const moneyBack = model.moneyBack.reduce((sum, r) => sum - r.spent, 0);

  return (
    <section aria-labelledby="chart-title">
      <h2 id="chart-title" className="text-lg font-semibold">
        Spending by category
      </h2>

      {rows.length === 0 ? (
        <p className="mt-4 text-ink-muted">Nothing spent in this period.</p>
      ) : (
        <ul className="mt-6 space-y-3" aria-label="Spending by category, largest first">
          {rows.map((row) => {
            const share = Math.round((row.spent / total) * 100);
            const isActive = active === row.category.id;
            return (
              <li key={row.category.id} className="relative">
                <a
                  href={hrefFor('transactions', { category: row.category.id, period: model.summary.period.label })}
                  aria-label={`${row.category.name}: ${wholeAmount(row.spent)}, ${share} % of spending. Show transactions`}
                  onPointerEnter={() => setActive(row.category.id)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(row.category.id)}
                  onBlur={() => setActive(null)}
                  className="grid gap-1 rounded-md sm:grid-cols-[10rem_1fr] sm:items-center sm:gap-4"
                >
                  <span className="text-sm" aria-hidden="true">
                    {row.category.name}
                  </span>
                  <span className="flex items-center gap-2" aria-hidden="true">
                    <span
                      className={`h-3 rounded-r-[4px] bg-chart-mark transition-[filter] ${isActive ? 'brightness-110' : ''}`}
                      data-ratio={row.spent / max}
                      // Proportional to the largest bar, within the room left after the value label.
                      style={{ width: `max(2px, calc((100% - 7rem) * ${row.spent / max}))` }}
                    />
                    <Amount ore={row.spent} tone="plain" size="inline" />
                  </span>
                </a>
                {isActive && (
                  <span
                    role="tooltip"
                    className="absolute -top-9 right-0 z-10 rounded-md border border-line bg-surface-raised px-2.5 py-1 text-sm whitespace-nowrap shadow-sm"
                  >
                    <strong className="font-semibold">{share} %</strong>{' '}
                    <span className="text-ink-muted">of spending</span>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {moneyBack > 0 && (
        <p className="mt-4 text-sm text-ink-muted">
          Not shown: {wholeAmount(moneyBack)} money back from people, which lowers total spending.
        </p>
      )}
    </section>
  );
}
