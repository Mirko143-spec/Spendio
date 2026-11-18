import { useEffect, useState } from 'react';
import type { Budget } from '../../core/budgets.ts';
import type { Category } from '../../core/categories.ts';
import { buildHistory } from '../../core/history.ts';
import type { Transaction } from '../../core/import.ts';
import { periodBounds } from '../../core/period-nav.ts';
import type { AppSettings } from '../../core/settings.ts';
import type { SpendioStore } from '../../storage/store.ts';
import { HistoryTable } from '../HistoryTable.tsx';
import { useRequestedWindowEnd, WINDOW } from '../period-window.ts';
import { PeriodWindowNav } from '../PeriodWindow.tsx';
import { hrefFor } from '../router.ts';
import { loadWhileMounted } from '../load.ts';
import { useStore } from '../useStore.ts';

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

/** "Do I keep going over?": spending per category, period by period (docs/SPEC.md §12). */
export function HistoryPage() {
  const store = useStore();
  const requestedEnd = useRequestedWindowEnd();
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => loadWhileMounted(() => fetchData(store), setData), [store]);

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
  const end = requestedEnd ?? bounds.initial;
  const model = buildHistory(data.transactions, data.categories, data.budgets, end, WINDOW, data.settings);
  const hasLimits = data.budgets.some((b) => b.amount !== null);

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

      <PeriodWindowNav end={end} bounds={bounds} />

      <HistoryTable model={model} />
    </section>
  );
}
