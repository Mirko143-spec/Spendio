import { useId, useState } from 'react';
import type { Category } from '../core/categories.ts';
import type { Transaction } from '../core/import.ts';
import { Amount } from './Amount.tsx';
import { counterpartyName, dateRange, groupTitle, KIND_LABEL_ONE } from './format.ts';

export const PAGE_SIZE = 100;

interface TransactionListProps {
  transactions: readonly Transaction[];
  categories: readonly Category[];
  /** Sets one transaction's category (null = back to Needs review). */
  onSetOne: (transactionId: string, categoryId: string | null) => Promise<void>;
  /** Sets it for this merchant from now on (a rule), optionally also for earlier transactions. */
  onSetMerchant: (transactionId: string, categoryId: string, includePast: boolean) => Promise<void>;
}

const titleOf = (t: Transaction) =>
  groupTitle({ kind: t.kind, merchantDisplay: t.merchantDisplay, isPerson: t.counterpartyIsPerson });

export function TransactionList({ transactions, categories, onSetOne, onSetMerchant }: TransactionListProps) {
  const [shown, setShown] = useState(PAGE_SIZE);

  if (transactions.length === 0) {
    return <p className="text-ink-muted">No transactions match these filters.</p>;
  }

  return (
    <div>
      <p className="text-sm text-ink-muted">
        {transactions.length} {transactions.length === 1 ? 'transaction' : 'transactions'}
      </p>
      <ul className="mt-3 divide-y divide-line border-y border-line">
        {transactions.slice(0, shown).map((t) => (
          <TransactionRow key={t.id} transaction={t} categories={categories} onSetOne={onSetOne} onSetMerchant={onSetMerchant} />
        ))}
      </ul>
      {transactions.length > shown && (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE_SIZE)}
          className="mt-4 text-sm font-medium text-accent hover:underline"
        >
          Show {Math.min(PAGE_SIZE, transactions.length - shown)} more
        </button>
      )}
    </div>
  );
}

function TransactionRow({
  transaction: t,
  categories,
  onSetOne,
  onSetMerchant,
}: { transaction: Transaction } & Omit<TransactionListProps, 'transactions'>) {
  const id = useId();
  const [pending, setPending] = useState<string | null>(null);
  const [includePast, setIncludePast] = useState(true);
  const [busy, setBusy] = useState(false);
  const title = titleOf(t);
  const shownCategory = pending ?? t.categoryId ?? '';

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
      setPending(null);
    } finally {
      setBusy(false);
    }
  }

  function choose(value: string) {
    if (value === (t.categoryId ?? '')) return setPending(null);
    // Back to Needs review only ever applies to this one transaction.
    if (value === '') return void run(() => onSetOne(t.id, null));
    setPending(value);
  }

  return (
    <li className="py-4">
      <div className="flex items-baseline justify-between gap-4">
        <div className="min-w-0">
          <p id={`${id}-title`} className="font-medium break-words">
            {title}
          </p>
          <p className="mt-0.5 text-sm text-ink-muted">
            {dateRange(t.effectiveDate, t.effectiveDate)}
            {t.kind !== 'other' && `, ${KIND_LABEL_ONE[t.kind]}`}
            {t.suggested && t.categoryId && ', suggested category'}
          </p>
        </div>
        <Amount ore={t.amount} />
      </div>

      <select
        aria-label={`Category for ${title}`}
        value={shownCategory}
        disabled={busy}
        onChange={(e) => choose(e.target.value)}
        className={`mt-2 w-full rounded-lg border border-line bg-surface-raised px-3 py-1.5 text-sm sm:w-64 ${
          shownCategory ? 'text-ink' : 'text-ink-muted'
        }`}
      >
        <option value="">Needs review</option>
        <optgroup label="Spending">
          {categories
            .filter((c) => c.type === 'spending')
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </optgroup>
        <optgroup label="Not spending">
          {categories
            .filter((c) => c.type !== 'spending')
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </optgroup>
      </select>

      {pending && (
        <div role="group" aria-labelledby={`${id}-ask`} className="mt-3 rounded-lg border border-line bg-surface-raised p-3">
          <p id={`${id}-ask`} className="text-sm">
            Change the category for…
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(() => onSetOne(t.id, pending))}
              className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium"
            >
              Only this one
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(() => onSetMerchant(t.id, pending, includePast))}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink"
            >
              All from {counterpartyName(t)}
            </button>
            <button type="button" onClick={() => setPending(null)} className="text-sm text-ink-muted hover:text-ink">
              Cancel
            </button>
          </div>
          <label className="mt-2 flex items-center gap-2 text-sm text-ink-muted">
            <input
              type="checkbox"
              checked={includePast}
              onChange={(e) => setIncludePast(e.target.checked)}
              className="size-4 accent-[var(--accent)]"
            />
            With “All from…”, also change earlier ones (your own choices stay as they are)
          </label>
        </div>
      )}
    </li>
  );
}
