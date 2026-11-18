import { useId, type ReactNode } from 'react';
import type { Category } from '../core/categories.ts';
import type { TransactionKind } from '../core/formats/types.ts';
import type { PeriodLabel } from '../core/periods.ts';
import { NO_FILTER, type TransactionFilter } from '../core/transaction-filter.ts';
import { KIND_LABELS, periodName } from './format.ts';

interface TransactionFiltersProps {
  filter: TransactionFilter;
  /** Periods that have transactions, newest first. */
  periods: readonly PeriodLabel[];
  categories: readonly Category[];
  onChange: (filter: TransactionFilter) => void;
}

const control = 'w-full rounded-lg border border-line bg-surface-raised px-3 py-1.5';

/** One row of filters above the list they scope (period, category, type, search). */
export function TransactionFilters({ filter, periods, categories, onChange }: TransactionFiltersProps) {
  const id = useId();
  const set = (change: Partial<TransactionFilter>) => onChange({ ...filter, ...change });
  const active = filter.period !== null || filter.category !== null || filter.kind !== null || filter.query !== '';

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_1fr_1.4fr]" role="search">
      <Field id={`${id}-period`} label="Period">
        <select
          id={`${id}-period`}
          className={control}
          value={filter.period ?? ''}
          onChange={(e) => set({ period: e.target.value || null })}
        >
          <option value="">All periods</option>
          {periods.map((p) => (
            <option key={p} value={p}>
              {periodName(p)}
            </option>
          ))}
        </select>
      </Field>

      <Field id={`${id}-category`} label="Category">
        <select
          id={`${id}-category`}
          className={control}
          value={filter.category ?? ''}
          onChange={(e) => set({ category: e.target.value || null })}
        >
          <option value="">All categories</option>
          <option value="needs-review">Needs review</option>
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
      </Field>

      <Field id={`${id}-kind`} label="Type">
        <select
          id={`${id}-kind`}
          className={control}
          value={filter.kind ?? ''}
          onChange={(e) => set({ kind: (e.target.value || null) as TransactionKind | null })}
        >
          <option value="">All types</option>
          {(Object.keys(KIND_LABELS) as TransactionKind[]).map((k) => (
            <option key={k} value={k}>
              {KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </Field>

      <Field id={`${id}-q`} label="Search">
        <input
          id={`${id}-q`}
          type="search"
          className={control}
          value={filter.query}
          placeholder="Merchant or name"
          onChange={(e) => set({ query: e.target.value })}
        />
      </Field>

      {active && (
        <button
          type="button"
          onClick={() => onChange(NO_FILTER)}
          className="col-span-2 justify-self-start text-sm font-medium text-accent hover:underline sm:col-span-4"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block text-sm text-ink-muted">
        {label}
      </label>
      {children}
    </div>
  );
}
