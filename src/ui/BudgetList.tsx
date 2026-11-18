import { useId, useState, type FormEvent, type ReactNode } from 'react';
import type { BudgetProgress } from '../core/budgets.ts';
import type { Category } from '../core/categories.ts';
import type { CategoryRow, DashboardModel } from '../core/dashboard.ts';
import { parseAmount, type Ore } from '../core/money.ts';
import { Amount } from './Amount.tsx';
import { periodName, wholeAmount } from './format.ts';

interface BudgetListProps {
  model: DashboardModel;
  /** All categories, to offer limits for ones without spending yet. */
  categories: readonly Category[];
  /** Sets (or with null removes) a limit from the shown period on. `categoryId` null = overall. */
  onSetLimit: (categoryId: string | null, amount: Ore | null) => Promise<void>;
}

/** Budgets for the period: Over first, then Close, then On track; other spending below (docs/SPEC.md §12). */
export function BudgetList({ model, categories, onSetLimit }: BudgetListProps) {
  const label = model.summary.period.label;
  const shown = new Set([...model.budgeted, ...model.unbudgeted, ...model.moneyBack].map((r) => r.category.id));
  const addable = categories.filter((c) => c.type === 'spending' && !shown.has(c.id));

  return (
    <section aria-labelledby="budgets-title">
      <h2 id="budgets-title" className="text-lg font-semibold">
        Budgets
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        Limits you change here apply from {periodName(label)} on. Earlier months keep theirs.
      </p>

      <ul className="mt-6 divide-y divide-line border-y border-line">
        <LimitRow
          name="All spending"
          spent={model.summary.netSpending}
          limit={model.overall.limit}
          progress={model.overall.progress}
          onSetLimit={(amount) => onSetLimit(null, amount)}
        />
        {model.budgeted.map((row) => (
          <CategoryLimitRow key={row.category.id} row={row} onSetLimit={onSetLimit} />
        ))}
        {model.unbudgeted.map((row) => (
          <CategoryLimitRow key={row.category.id} row={row} onSetLimit={onSetLimit} />
        ))}
        {model.moneyBack.map((row) => (
          <li key={row.category.id} className="flex items-baseline justify-between gap-4 py-4">
            <CategoryName category={row.category} />
            <span className="flex items-baseline gap-2">
              <Amount ore={-row.spent} />
              <span className="text-sm text-ink-muted">back</span>
            </span>
          </li>
        ))}
      </ul>

      {addable.length > 0 && <AddLimit categories={addable} onSetLimit={onSetLimit} />}
    </section>
  );
}

function CategoryName({ category }: { category: Category }) {
  return (
    <span className="flex items-center gap-2.5 font-medium">
      <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
      {category.name}
    </span>
  );
}

function CategoryLimitRow({
  row,
  onSetLimit,
}: {
  row: CategoryRow;
  onSetLimit: BudgetListProps['onSetLimit'];
}) {
  return (
    <LimitRow
      name={<CategoryName category={row.category} />}
      spent={row.spent}
      limit={row.limit}
      progress={row.progress}
      onSetLimit={(amount) => onSetLimit(row.category.id, amount)}
    />
  );
}

function statusText(progress: BudgetProgress): string {
  if (progress.status === 'over') return `Over by ${wholeAmount(progress.overBy)}`;
  return `${Math.round(progress.ratio * 100)} % used, ${wholeAmount(progress.remaining)} left`;
}

function LimitRow({
  name,
  spent,
  limit,
  progress,
  onSetLimit,
}: {
  name: ReactNode;
  spent: Ore;
  limit: Ore | null;
  progress: BudgetProgress | null;
  onSetLimit: (amount: Ore | null) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <li className="py-4">
      <div className="flex items-baseline justify-between gap-4">
        {typeof name === 'string' ? <span className="font-medium">{name}</span> : name}
        <span className="flex items-baseline gap-1.5 whitespace-nowrap">
          <Amount ore={spent} tone="plain" />
          {limit !== null && <span className="text-sm text-ink-muted">of {wholeAmount(limit)}</span>}
        </span>
      </div>

      {progress && (
        <>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-chart-mark/15" aria-hidden="true">
            <div
              className={`h-full rounded-full ${
                progress.status === 'over' ? 'bg-danger' : progress.status === 'close' ? 'bg-ink' : 'bg-chart-mark'
              }`}
              style={{ width: `${Math.min(100, Math.round(progress.ratio * 100))}%` }}
            />
          </div>
          <p className={`mt-1.5 text-sm ${progress.status === 'over' ? 'font-medium text-danger' : 'text-ink-muted'}`}>
            {statusText(progress)}
          </p>
        </>
      )}

      {editing ? (
        <LimitForm
          current={limit}
          onCancel={() => setEditing(false)}
          onSave={async (amount) => {
            await onSetLimit(amount);
            setEditing(false);
          }}
        />
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="mt-1.5 text-sm font-medium text-accent hover:underline">
          {limit === null ? 'Set limit' : 'Change limit'}
        </button>
      )}
    </li>
  );
}

function LimitForm({
  current,
  onSave,
  onCancel,
}: {
  current: Ore | null;
  onSave: (amount: Ore | null) => Promise<void>;
  onCancel: () => void;
}) {
  const id = useId();
  const [value, setValue] = useState(current === null ? '' : String(current / 100).replace('.', ','));
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    let amount: Ore;
    try {
      amount = parseAmount(value.replace(/\s*kr\s*$/i, ''));
    } catch {
      return setError('Enter an amount in kronor, e.g. 1500 or 1 500,50.');
    }
    if (amount <= 0) return setError('Enter an amount above 0, or remove the limit.');
    await onSave(amount);
  }

  return (
    <form onSubmit={submit} className="mt-3 flex flex-wrap items-center gap-3">
      <label htmlFor={id} className="sr-only">
        Monthly limit in kronor
      </label>
      <input
        id={id}
        inputMode="decimal"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Monthly limit, kr"
        aria-invalid={error !== null}
        aria-describedby={error ? `${id}-error` : undefined}
        className="w-40 rounded-lg border border-line bg-surface-raised px-3 py-1.5"
      />
      <button type="submit" className="rounded-lg bg-accent px-4 py-1.5 font-semibold text-accent-ink">
        Save limit
      </button>
      {current !== null && (
        <button type="button" onClick={() => void onSave(null)} className="text-sm font-medium text-ink-muted hover:text-ink">
          Remove limit
        </button>
      )}
      <button type="button" onClick={onCancel} className="text-sm font-medium text-ink-muted hover:text-ink">
        Cancel
      </button>
      {error && (
        <p id={`${id}-error`} role="alert" className="w-full text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </form>
  );
}

function AddLimit({
  categories,
  onSetLimit,
}: {
  categories: readonly Category[];
  onSetLimit: BudgetListProps['onSetLimit'];
}) {
  const id = useId();
  const [categoryId, setCategoryId] = useState('');

  return (
    <div className="mt-6">
      <label htmlFor={id} className="text-sm text-ink-muted">
        Set a limit for another category
      </label>
      <div className="mt-2 flex flex-wrap items-start gap-3">
        <select
          id={id}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="rounded-lg border border-line bg-surface-raised px-3 py-1.5"
        >
          <option value="">Choose a category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {categoryId && (
          <LimitForm
            key={categoryId}
            current={null}
            onCancel={() => setCategoryId('')}
            onSave={async (amount) => {
              await onSetLimit(categoryId, amount);
              setCategoryId('');
            }}
          />
        )}
      </div>
    </div>
  );
}
