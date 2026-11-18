import { useState } from 'react';
import type { Category } from '../core/categories.ts';
import type { Ore } from '../core/money.ts';
import type { PeriodLabel } from '../core/periods.ts';
import { periodName, wholeAmount } from './format.ts';
import { LimitForm } from './LimitForm.tsx';

interface CategoryLimitProps {
  category: Category;
  /** The limit in force for `period`, or null. */
  limit: Ore | null;
  /** The current period; changes apply from it on. */
  period: PeriodLabel;
  onSetLimit: (amount: Ore | null) => Promise<void>;
}

/** A spending category's monthly limit, set or changed in place. */
export function CategoryLimit({ category, limit, period, onSetLimit }: CategoryLimitProps) {
  const [editing, setEditing] = useState(false);
  if (category.type !== 'spending') return null;

  if (editing) {
    return (
      <div className="w-full">
        <p className="mt-1 text-ink-muted">Monthly limit for {category.name}, from {periodName(period)} on</p>
        <LimitForm
          current={limit}
          onCancel={() => setEditing(false)}
          onSave={async (amount) => {
            await onSetLimit(amount);
            setEditing(false);
          }}
        />
      </div>
    );
  }

  return (
    <span className="flex items-baseline gap-2">
      {limit !== null && <span className="text-ink-muted">Limit {wholeAmount(limit)} a month</span>}
      <button type="button" onClick={() => setEditing(true)} className="font-medium text-accent hover:underline">
        {limit === null ? 'Set a monthly limit' : 'Change limit'}
      </button>
    </span>
  );
}
