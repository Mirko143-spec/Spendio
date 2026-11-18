import { useId, useState, type ReactNode } from 'react';
import type { BudgetProgress } from '../core/budgets.ts';
import type { Category } from '../core/categories.ts';
import type { CategoryRow, DashboardModel } from '../core/dashboard.ts';
import type { Ore } from '../core/money.ts';
import { Amount } from './Amount.tsx';
import { LimitForm } from './LimitForm.tsx';
import { periodName, wholeAmount } from './format.ts';
import { hrefFor } from './router.ts';

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
  // Only limits live here; spending without a limit is in the chart below, so it isn't repeated.
  const budgetedIds = new Set(model.budgeted.map((r) => r.category.id));
  const addable = categories.filter((c) => c.type === 'spending' && !budgetedIds.has(c.id));

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
          name={
            <a href={hrefFor('transactions', { period: label })} className="font-medium hover:underline">
              All spending
            </a>
          }
          spent={model.summary.netSpending}
          limit={model.overall.limit}
          progress={model.overall.progress}
          onSetLimit={(amount) => onSetLimit(null, amount)}
        />
        {model.budgeted.map((row) => (
          <CategoryLimitRow key={row.category.id} row={row} period={label} onSetLimit={onSetLimit} />
        ))}
      </ul>
      {model.budgeted.length === 0 && (
        <p className="mt-4 text-sm text-ink-muted">No category limits yet. Choose a category below to set one.</p>
      )}

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
  period,
  onSetLimit,
}: {
  row: CategoryRow;
  period: string;
  onSetLimit: BudgetListProps['onSetLimit'];
}) {
  return (
    <LimitRow
      name={
        <a href={hrefFor('transactions', { category: row.category.id, period })} className="hover:underline">
          <CategoryName category={row.category} />
        </a>
      }
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
