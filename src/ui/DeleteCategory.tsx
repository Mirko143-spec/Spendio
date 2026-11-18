import { useId, useState } from 'react';
import { CATEGORY_IDS, type Category } from '../core/categories.ts';
import type { CategoryUsage } from '../core/category-usage.ts';

interface DeleteCategoryProps {
  category: Category;
  categories: readonly Category[];
  usage: CategoryUsage | undefined;
  /** Deletes the category, moving its transactions and rules to `moveToId`. */
  onDelete: (id: string, moveToId: string) => Promise<void>;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "Delete" with an inline confirmation that says what moves where (no browser dialogs). */
export function DeleteCategory({ category, categories, usage, onDelete }: DeleteCategoryProps) {
  const id = useId();
  const targets = categories.filter((c) => c.id !== category.id);
  const fallback = targets.find((c) => c.id === CATEGORY_IDS.other) ?? targets[0];
  const [open, setOpen] = useState(false);
  const [moveTo, setMoveTo] = useState(fallback?.id ?? '');
  const [error, setError] = useState<string | null>(null);

  if (category.system) return null;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="font-medium text-ink-muted hover:text-danger">
        Delete
      </button>
    );
  }

  const moving = [
    usage?.transactions ? plural(usage.transactions, 'transaction', 'transactions') : null,
    usage?.rules ? plural(usage.rules, 'rule', 'rules') : null,
  ].filter(Boolean);

  async function confirm() {
    setError(null);
    try {
      await onDelete(category.id, moveTo);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div role="group" aria-labelledby={`${id}-title`} className="mt-2 w-full rounded-lg border border-line bg-surface-raised p-3">
      <p id={`${id}-title`} className="font-medium">
        Delete {category.name}?
      </p>
      {moving.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label htmlFor={`${id}-to`}>Move its {moving.join(' and ')} to</label>
          <select
            id={`${id}-to`}
            value={moveTo}
            onChange={(e) => setMoveTo(e.target.value)}
            className="rounded-lg border border-line bg-surface px-3 py-1.5"
          >
            {targets.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p className="mt-1 text-ink-muted">Nothing is in this category yet.</p>
      )}
      {usage?.limits ? (
        <p className="mt-2 text-ink-muted">Its monthly limit will be removed.</p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <button type="button" onClick={() => void confirm()} className="rounded-lg bg-danger px-4 py-1.5 font-semibold text-surface">
          Delete {category.name}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-ink-muted hover:text-ink">
          Cancel
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
