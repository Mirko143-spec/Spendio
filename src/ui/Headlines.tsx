import type { ReactNode } from 'react';
import type { DashboardModel } from '../core/dashboard.ts';
import { shiftPeriod } from '../core/periods.ts';
import { Amount } from './Amount.tsx';
import { periodName, wholeAmount } from './format.ts';

const percent = (ratio: number) => `${Math.round(Math.abs(ratio) * 100)} %`;

/** The three numbers that answer "how am I doing this period?" (docs/SPEC.md §12). */
export function Headlines({ model }: { model: DashboardModel }) {
  const { summary, spentChange, overall } = model;
  const previous = periodName(shiftPeriod(summary.period.label, -1)).split(' ')[0];

  const changeText =
    spentChange === null
      ? `Nothing spent in ${previous}`
      : Math.round(spentChange * 100) === 0
        ? `About the same as ${previous}`
        : `${percent(spentChange)} ${spentChange > 0 ? 'more' : 'less'} than ${previous}`;

  const remaining = overall.limit === null ? null : overall.limit - summary.netSpending;

  return (
    <dl className="grid gap-8 sm:grid-cols-3 sm:gap-6">
      <Figure label="Spent" note={changeText}>
        <Amount ore={summary.netSpending} tone="plain" size="headline" />
      </Figure>

      <Figure
        label={remaining !== null && remaining < 0 ? 'Over budget by' : 'Budget left'}
        note={overall.limit === null ? 'No overall limit set' : `of a ${wholeAmount(overall.limit)} limit`}
      >
        {remaining === null ? (
          <span className="text-title font-semibold text-ink-muted">–</span>
        ) : (
          <Amount ore={Math.abs(remaining)} tone={remaining < 0 ? 'danger' : 'plain'} size="headline" />
        )}
      </Figure>

      <Figure
        label="Left over"
        note={summary.savingsRate === null ? 'No income this period' : `${percent(summary.savingsRate)} of income`}
      >
        <Amount ore={summary.leftOver} size="headline" />
      </Figure>
    </dl>
  );
}

function Figure({ label, note, children }: { label: string; note: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="mt-1">{children}</dd>
      <dd className="mt-1 text-sm text-ink-muted">{note}</dd>
    </div>
  );
}
