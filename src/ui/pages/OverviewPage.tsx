import { useEffect, useState } from 'react';
import type { Budget } from '../../core/budgets.ts';
import type { Category } from '../../core/categories.ts';
import { buildDashboard } from '../../core/dashboard.ts';
import type { Transaction } from '../../core/import.ts';
import { periodBounds } from '../../core/period-nav.ts';
import type { PeriodLabel } from '../../core/periods.ts';
import type { AppSettings } from '../../core/settings.ts';
import type { SpendioStore } from '../../storage/store.ts';
import { BudgetList } from '../BudgetList.tsx';
import { Headlines } from '../Headlines.tsx';
import { PeriodSwitcher } from '../PeriodSwitcher.tsx';
import { hrefFor } from '../router.ts';
import { SpendingChart } from '../SpendingChart.tsx';
import { useStore } from '../useStore.ts';

interface Data {
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  settings: AppSettings;
}

const today = () => new Date().toISOString().slice(0, 10);

async function fetchData(store: SpendioStore): Promise<Data> {
  const [transactions, categories, budgets, settings] = await Promise.all([
    store.listTransactions(),
    store.listCategories(),
    store.listBudgets(),
    store.getSettings(),
  ]);
  return { transactions, categories, budgets, settings };
}

/** The dashboard for one period (docs/SPEC.md §12). */
export function OverviewPage() {
  const store = useStore();
  const [data, setData] = useState<Data | null>(null);
  const [label, setLabel] = useState<PeriodLabel | null>(null);

  /** Bumped after a change, to load fresh data. */
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let live = true;
    void fetchData(store).then((d) => {
      if (live) setData(d);
    });
    return () => {
      live = false;
    };
  }, [store, version]);

  if (!data) return null;

  if (data.transactions.length === 0) {
    return (
      <section aria-labelledby="overview-title">
        <h1 id="overview-title" className="text-title font-semibold tracking-[-0.015em]">
          No transactions yet
        </h1>
        <p className="mt-4 max-w-prose text-ink-muted">
          Add a bank statement to see where your money goes.{' '}
          <a href={hrefFor('add')} className="font-medium text-accent underline">
            Add a statement
          </a>
        </p>
      </section>
    );
  }

  const bounds = periodBounds(data.transactions, today(), data.settings);
  const shown = label ?? bounds.initial;
  const model = buildDashboard(data.transactions, data.categories, data.budgets, shown, data.settings);

  return (
    <div className="space-y-12">
      <section aria-labelledby="overview-title" className="space-y-8">
        <h1 id="overview-title" className="sr-only">
          Overview
        </h1>
        <PeriodSwitcher period={model.summary.period} bounds={bounds} onChange={setLabel} />

        {model.needsReviewCount > 0 && (
          <p className="rounded-lg border border-line bg-surface-raised px-4 py-3 text-sm">
            {model.needsReviewCount === 1 ? '1 transaction is' : `${model.needsReviewCount} transactions are`} waiting
            for you to choose or confirm a category.{' '}
            <a href={hrefFor('review')} className="font-medium text-accent underline">
              Review them
            </a>
          </p>
        )}

        <Headlines model={model} />
      </section>

      <BudgetList
        model={model}
        categories={data.categories}
        onSetLimit={async (categoryId, amount) => {
          await store.setBudgetLimit(categoryId, amount, shown, () => crypto.randomUUID());
          setVersion((v) => v + 1);
        }}
      />

      <SpendingChart model={model} />
    </div>
  );
}
