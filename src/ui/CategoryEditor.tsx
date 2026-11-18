import { useId, useState, type FormEvent, type ReactNode } from 'react';
import type { Category } from '../core/categories.ts';
import type { CategoryUsage } from '../core/category-usage.ts';

export interface CategoryEditorProps {
  categories: readonly Category[];
  usage: ReadonlyMap<string, CategoryUsage>;
  onUpdate: (id: string, changes: { name?: string; color?: string }) => Promise<void>;
  onAdd: (input: { name: string; color: string }) => Promise<void>;
  /** Extra controls for a category row (delete, limit), rendered under its name. */
  renderExtra?: (category: Category) => ReactNode;
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Rename, recolor and add categories (docs/SPEC.md §6, §12). */
export function CategoryEditor({ categories, usage, onUpdate, onAdd, renderExtra }: CategoryEditorProps) {
  const spending = categories.filter((c) => c.type === 'spending');
  const other = categories.filter((c) => c.type !== 'spending');

  return (
    <div className="space-y-10">
      <CategoryGroup title="Spending" categories={spending} usage={usage} onUpdate={onUpdate} renderExtra={renderExtra} />
      <AddCategory onAdd={onAdd} />
      <CategoryGroup
        title="Not spending"
        note="Income and transfers never count as spending."
        categories={other}
        usage={usage}
        onUpdate={onUpdate}
        renderExtra={renderExtra}
      />
    </div>
  );
}

function CategoryGroup({
  title,
  note,
  categories,
  usage,
  onUpdate,
  renderExtra,
}: {
  title: string;
  note?: string;
  categories: readonly Category[];
  usage: ReadonlyMap<string, CategoryUsage>;
  onUpdate: CategoryEditorProps['onUpdate'];
  renderExtra: CategoryEditorProps['renderExtra'];
}) {
  return (
    <section aria-label={`${title} categories`}>
      <h2 className="text-lg font-semibold">{title}</h2>
      {note && <p className="mt-1 text-sm text-ink-muted">{note}</p>}
      <ul className="mt-4 divide-y divide-line border-y border-line">
        {categories.map((c) => (
          <CategoryRow key={c.id} category={c} usage={usage.get(c.id)} onUpdate={onUpdate} extra={renderExtra?.(c)} />
        ))}
      </ul>
    </section>
  );
}

function CategoryRow({
  category,
  usage,
  onUpdate,
  extra,
}: {
  category: Category;
  usage: CategoryUsage | undefined;
  onUpdate: CategoryEditorProps['onUpdate'];
  extra: ReactNode;
}) {
  const id = useId();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(category.name);
  const [error, setError] = useState<string | null>(null);
  const count = usage?.transactions ?? 0;

  async function save(changes: { name?: string; color?: string }) {
    setError(null);
    try {
      await onUpdate(category.id, changes);
      setRenaming(false);
    } catch (e) {
      setError(errorText(e));
    }
  }

  return (
    <li className="py-4">
      <div className="flex items-center gap-3">
        <input
          type="color"
          aria-label={`Color for ${category.name}`}
          value={category.color}
          onChange={(e) => void save({ color: e.target.value })}
          className="size-6 shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
        />
        {renaming ? (
          <form
            className="flex flex-1 flex-wrap items-center gap-3"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              void save({ name });
            }}
          >
            <label htmlFor={`${id}-name`} className="sr-only">
              New name for {category.name}
            </label>
            <input
              id={`${id}-name`}
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-line bg-surface-raised px-3 py-1.5"
            />
            <button type="submit" className="rounded-lg bg-accent px-4 py-1.5 font-semibold text-accent-ink">
              Save name
            </button>
            <button
              type="button"
              onClick={() => {
                setRenaming(false);
                setName(category.name);
                setError(null);
              }}
              className="text-sm text-ink-muted hover:text-ink"
            >
              Cancel
            </button>
          </form>
        ) : (
          <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-4">
            <span className="font-medium">{category.name}</span>
            <span className="text-sm text-ink-muted">
              {count === 1 ? '1 transaction' : `${count} transactions`}
              {category.system && ', built in'}
            </span>
          </div>
        )}
      </div>

      {!renaming && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-2 pl-9 text-sm">
          <button type="button" onClick={() => setRenaming(true)} className="font-medium text-accent hover:underline">
            Rename
          </button>
          {extra}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 pl-9 text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </li>
  );
}

function AddCategory({ onAdd }: { onAdd: CategoryEditorProps['onAdd'] }) {
  const id = useId();
  const [name, setName] = useState('');
  const [color, setColor] = useState('#64748b');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await onAdd({ name, color });
      setName('');
    } catch (err) {
      setError(errorText(err));
    }
  }

  return (
    <form onSubmit={submit} aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className="text-sm text-ink-muted">
        Add a spending category
      </h3>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <input
          type="color"
          aria-label="Color for the new category"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="size-6 shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
        />
        <label htmlFor={`${id}-name`} className="sr-only">
          Name of the new category
        </label>
        <input
          id={`${id}-name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Pets"
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface-raised px-3 py-1.5 sm:max-w-64"
        />
        <button type="submit" className="rounded-lg bg-accent px-4 py-1.5 font-semibold text-accent-ink">
          Add category
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
