import { useEffect, useMemo, useState } from 'react';
import type { Category } from '../../core/categories.ts';
import type { TransactionKind } from '../../core/formats/types.ts';
import type { Transaction } from '../../core/import.ts';
import { periodOf } from '../../core/periods.ts';
import type { AppSettings } from '../../core/settings.ts';
import { filterTransactions, type TransactionFilter } from '../../core/transaction-filter.ts';
import type { SpendioStore } from '../../storage/store.ts';
import { replaceParams, useRouteParams } from '../router.ts';
import { TransactionFilters } from '../TransactionFilters.tsx';
import { TransactionList } from '../TransactionList.tsx';
import { loadWhileMounted } from '../load.ts';
import { newId } from '../new-id.ts';
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

const context = () => ({ now: new Date().toISOString(), newId: newId });

/** Every transaction, filterable, with categories editable inline (docs/SPEC.md §12). */
export function TransactionsPage() {
  const store = useStore();
  const params = useRouteParams();
  const [data, setData] = useState<Data | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => loadWhileMounted(() => fetchData(store), setData), [store, version]);

  // Filters live in the URL (#/transactions?period=…&category=…&kind=…&q=…).
  const filter: TransactionFilter = useMemo(
    () => ({
      period: params.get('period'),
      category: params.get('category'),
      kind: params.get('kind') as TransactionKind | null,
      query: params.get('q') ?? '',
    }),
    [params],
  );

  if (!data) return null;

  const periods = [...new Set(data.transactions.map((t) => periodOf(t.effectiveDate, data.settings)))].sort().reverse();
  const reload = () => setVersion((v) => v + 1);

  return (
    <section aria-labelledby="transactions-title" className="space-y-8">
      <h1 id="transactions-title" className="text-title font-semibold tracking-[-0.015em]">
        Transactions
      </h1>
      <TransactionFilters
        filter={filter}
        periods={periods}
        categories={data.categories}
        onChange={(f) => replaceParams({ period: f.period, category: f.category, kind: f.kind, q: f.query })}
      />
      <TransactionList
        transactions={filterTransactions(data.transactions, filter, data.settings)}
        categories={data.categories}
        onSetOne={async (id, categoryId) => {
          await store.setTransactionCategory(id, categoryId);
          reload();
        }}
        onSetMerchant={async (id, categoryId, includePast) => {
          await store.applyCategoryToMerchant(id, categoryId, { includePast }, context());
          reload();
        }}
      />
    </section>
  );
}
