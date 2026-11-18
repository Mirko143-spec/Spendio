import { useEffect, useState } from 'react';
import type { Budget } from '../../core/budgets.ts';
import type { Category } from '../../core/categories.ts';
import { buildHistory } from '../../core/history.ts';
import type { Transaction } from '../../core/import.ts';
import { periodBounds } from '../../core/period-nav.ts';
import { shiftPeriod } from '../../core/periods.ts';
import type { AppSettings } from '../../core/settings.ts';
import type { SpendioStore } from '../../storage/store.ts';
import { periodName } from '../format.ts';
import { HistoryTable } from '../HistoryTable.tsx';
import { hrefFor, replaceParams, useRouteParams } from '../router.ts';
import { useStore } from '../useStore.ts';

/** How many periods the table shows at once. */
export const WINDOW = 6;

interface Data {
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  settings: AppSettings;
}

async function fetchData(store: SpendioStore): Promise<Data> {
  const [transactions, categories, budgets, settings] = await Promise.all([
    store.listTransactions(),
    store.listCategories(),
    store.listBudgets(),
    store.getSettings(),
  ]);
  return { transactions, categories, budgets, settings };
}

const LABEL = /^\d{4}-(0[1-9]|1[0-2])$/;

/** "Do I keep going over?": spending per category, period by period (docs/SPEC.md §12). */
export function HistoryPage() {
  const store = useStore();
  const params = useRouteParams();
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    let live = true;
    void fetchData(store).then((d) => {
      if (live) setData(d);
    });
    return () => {
      live = false;
    };
  }, [store]);

  if (!data) return null;

  if (data.transactions.length === 0) {
    return (
      <section aria-labelledby="history-title">
        <h1 id="history-title" className="text-title font-semibold tracking-[-0.015em]">
          History
        </h1>
        <p className="mt-4 text-ink-muted">
          Nothing to compare yet.{' '}
          <a href={hrefFor('add')} className="font-medium text-accent underline">
            Add a statement
          </a>
        </p>
      </section>
    );
  }

  const bounds = periodBounds(data.transactions, new Date().toISOString().slice(0, 10), data.settings);
  const requested = params.get('end');
  const end = requested && LABEL.test(requested) ? requested : bounds.initial;
  const start = shiftPeriod(end, -(WINDOW - 1));
  const model = buildHistory(data.transactions, data.categories, data.budgets, end, WINDOW, data.settings);
  const hasLimits = data.budgets.some((b) => b.amount !== null);
  const button = 'rounded-lg px-2 py-1.5 text-sm font-medium text-ink-muted hover:text-ink disabled:invisible';

  return (
    <section aria-labelledby="history-title" className="space-y-8">
      <div>
        <h1 id="history-title" className="text-title font-semibold tracking-[-0.015em]">
          History
        </h1>
        <p className="mt-4 max-w-prose text-ink-muted">
          Spending in each period, against the limit that applied then.
          {!hasLimits && (
            <>
              {' '}
              <a href={hrefFor('categories')} className="font-medium text-accent underline">
                Set limits
              </a>{' '}
              to see where you go over.
            </>
          )}
        </p>
      </div>

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
          onClick={() => replaceParams({ end: shiftPeriod(end, WINDOW) })}
        >
          Later ›
        </button>
      </div>

      <HistoryTable model={model} />
    </section>
  );
}
