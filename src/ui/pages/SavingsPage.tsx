import { useEffect, useState, type ReactNode } from 'react';
import type { Category } from '../../core/categories.ts';
import type { Transaction } from '../../core/import.ts';
import { periodBounds } from '../../core/period-nav.ts';
import { buildSavings, type SavingsModel } from '../../core/savings.ts';
import type { AppSettings } from '../../core/settings.ts';
import type { SpendioStore } from '../../storage/store.ts';
import { Amount } from '../Amount.tsx';
import { ColumnChart } from '../ColumnChart.tsx';
import { periodName, wholeAmount } from '../format.ts';
import { useRequestedWindowEnd, WINDOW } from '../period-window.ts';
import { PeriodWindowNav } from '../PeriodWindow.tsx';
import { hrefFor } from '../router.ts';
import { loadWhileMounted } from '../load.ts';
import { useStore } from '../useStore.ts';

interface Data {
  transactions: Transaction[];
  categories: Category[];
  settings: AppSettings;
}

async function fetchData(store: SpendioStore): Promise<Data> {
  const [transactions, categories, settings] = await Promise.all([
    store.listTransactions(),
    store.listCategories(),
    store.getSettings(),
  ]);
  return { transactions, categories, settings };
}

const percent = (ratio: number | null) => (ratio === null ? '–' : `${Math.round(ratio * 100)} %`);

/** Left over, savings rate and money moved to savings, period by period (docs/SPEC.md §11–12). */
export function SavingsPage() {
  const store = useStore();
  const requestedEnd = useRequestedWindowEnd();
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => loadWhileMounted(() => fetchData(store), setData), [store]);

  if (!data) return null;

  if (data.transactions.length === 0) {
    return (
      <section aria-labelledby="savings-title">
        <h1 id="savings-title" className="text-title font-semibold tracking-[-0.015em]">
          Savings
        </h1>
        <p className="mt-4 text-ink-muted">
          Nothing to show yet.{' '}
          <a href={hrefFor('add')} className="font-medium text-accent underline">
            Add a statement
          </a>
        </p>
      </section>
    );
  }

  const bounds = periodBounds(data.transactions, new Date().toISOString().slice(0, 10), data.settings);
  const end = requestedEnd ?? bounds.initial;
  const model = buildSavings(data.transactions, data.categories, end, WINDOW, data.settings);
  const movedAny = model.periods.some((p) => p.movedToSavings !== 0);

  return (
    <section aria-labelledby="savings-title" className="space-y-10">
      <div>
        <h1 id="savings-title" className="text-title font-semibold tracking-[-0.015em]">
          Savings
        </h1>
        <p className="mt-4 max-w-prose text-ink-muted">
          What was left over after spending, and what you moved to savings accounts like Lysa.
        </p>
      </div>

      <PeriodWindowNav end={end} bounds={bounds} />

      <dl className="grid gap-8 sm:grid-cols-3 sm:gap-6">
        <Figure label="Left over" note={`of ${wholeAmount(model.totals.income)} income`}>
          <Amount ore={model.totals.leftOver} size="headline" />
        </Figure>
        <Figure label="Savings rate" note="of income left over">
          <span className="text-title font-semibold tracking-[-0.015em]">{percent(model.savingsRate)}</span>
        </Figure>
        <Figure label="Moved to savings" note="net, after money taken out">
          <Amount ore={model.totals.movedToSavings} tone="plain" size="headline" />
        </Figure>
      </dl>

      <ColumnChart title="Left over each period" data={model.periods.map((p) => ({ period: p.period, value: p.leftOver }))} />

      {movedAny ? (
        <ColumnChart
          title="Moved to savings each period"
          data={model.periods.map((p) => ({ period: p.period, value: p.movedToSavings }))}
        />
      ) : (
        <p className="text-ink-muted">
          Nothing was moved to savings in these periods. Transfers to savings accounts (like Lysa) show up here.
        </p>
      )}

      <SavingsTable model={model} />
    </section>
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

/** The same numbers as a table: the charts' accessible, exact view. */
function SavingsTable({ model }: { model: SavingsModel }) {
  const cell = 'border-b border-line px-3 py-2 text-right whitespace-nowrap';
  return (
    <div>
      <h2 className="font-semibold">In numbers</h2>
      <p className="mt-2 mb-2 text-xs text-ink-muted sm:hidden">Scroll sideways for more columns.</p>
      <div className="overflow-x-auto">
        <table className="mt-2 w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 border-b border-line bg-surface py-2 pr-3 text-left font-normal text-ink-muted">
                Period
              </th>
              {['Income', 'Spent', 'Left over', 'Rate', 'Moved to savings'].map((h) => (
                <th key={h} scope="col" className={`${cell} font-normal text-ink-muted`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {model.periods.map((p) => (
              <tr key={p.period.label}>
                <th scope="row" className="sticky left-0 border-b border-line bg-surface py-2 pr-3 text-left font-medium whitespace-nowrap">
                  {periodName(p.period.label)}
                </th>
                <td className={cell}>{wholeAmount(p.income)}</td>
                <td className={cell}>{wholeAmount(p.netSpending)}</td>
                <td className={`${cell} font-semibold`}>{wholeAmount(p.leftOver)}</td>
                <td className={cell}>{percent(p.savingsRate)}</td>
                <td className={cell}>{wholeAmount(p.movedToSavings)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
