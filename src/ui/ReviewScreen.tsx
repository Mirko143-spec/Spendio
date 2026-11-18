import { useId, useState } from 'react';
import type { Category } from '../core/categories.ts';
import type { ReviewDecision, ReviewGroup } from '../core/review.ts';
import { Amount } from './Amount.tsx';
import { groupContext, groupTitle } from './format.ts';

interface Choice {
  categoryId: string | null;
  remember: boolean;
}

interface ReviewScreenProps {
  groups: readonly ReviewGroup[];
  categories: readonly Category[];
  onSave: (decisions: ReviewDecision[]) => void;
  onSkip: () => void;
}

/** Post-import review: one decision per merchant, biggest amounts first (docs/SPEC.md §12). */
export function ReviewScreen({ groups, categories, onSave, onSkip }: ReviewScreenProps) {
  const [choices, setChoices] = useState<Record<string, Choice>>(() =>
    Object.fromEntries(groups.map((g) => [g.key, { categoryId: g.suggestedCategoryId, remember: g.rememberByDefault }])),
  );
  const transactionCount = groups.reduce((n, g) => n + g.transactionIds.length, 0);
  const chosen = groups.filter((g) => choices[g.key]?.categoryId).length;

  const update = (key: string, change: Partial<Choice>) =>
    setChoices((current) => ({ ...current, [key]: { ...current[key]!, ...change } }));

  const save = () =>
    onSave(
      groups.map((g) => ({
        groupKey: g.key,
        transactionIds: g.transactionIds,
        merchantKey: g.merchantKey,
        kind: g.kind,
        categoryId: choices[g.key]!.categoryId,
        remember: choices[g.key]!.remember,
      })),
    );

  if (groups.length === 0) {
    return (
      <section>
        <h1 className="text-title font-semibold tracking-[-0.015em]">Everything is categorized</h1>
        <p className="mt-4 text-ink-muted">Spendio recognized every transaction in this import.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="review-title">
      <h1 id="review-title" className="text-title font-semibold tracking-[-0.015em]">
        Review {transactionCount} {transactionCount === 1 ? 'transaction' : 'transactions'}
      </h1>
      <p className="mt-4 max-w-prose text-ink-muted">
        Choose a category once per merchant. Anything you leave blank stays in Needs review and isn't counted yet.
      </p>

      <ul className="mt-10 divide-y divide-line border-y border-line">
        {groups.map((group) => (
          <ReviewRow
            key={group.key}
            group={group}
            categories={categories}
            choice={choices[group.key]!}
            onChange={(change) => update(group.key, change)}
          />
        ))}
      </ul>

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
        <button
          type="button"
          onClick={onSkip}
          className="rounded-lg px-4 py-2.5 font-medium text-ink-muted hover:text-ink"
        >
          Skip for now
        </button>
        <button
          type="button"
          onClick={save}
          disabled={chosen === 0}
          className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-ink disabled:opacity-40"
        >
          {chosen === 0 ? 'Save choices' : `Save ${chosen} of ${groups.length}`}
        </button>
      </div>
    </section>
  );
}

function ReviewRow({
  group,
  categories,
  choice,
  onChange,
}: {
  group: ReviewGroup;
  categories: readonly Category[];
  choice: Choice;
  onChange: (change: Partial<Choice>) => void;
}) {
  const id = useId();
  const spending = categories.filter((c) => c.type === 'spending');
  const other = categories.filter((c) => c.type !== 'spending');

  return (
    <li className="py-5">
      <div className="flex items-baseline justify-between gap-4">
        <div className="min-w-0">
          <p id={`${id}-title`} className="font-semibold break-words">
            {groupTitle(group)}
          </p>
          <p className="mt-0.5 text-sm text-ink-muted">{groupContext(group)}</p>
        </div>
        <Amount ore={group.total} />
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
        <select
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-cat`}
          value={choice.categoryId ?? ''}
          onChange={(e) => onChange({ categoryId: e.target.value || null })}
          className={`w-full rounded-lg border border-line bg-surface-raised px-3 py-2 sm:w-64 ${
            choice.categoryId ? 'text-ink' : 'text-ink-muted'
          }`}
        >
          <option value="">Choose a category</option>
          <optgroup label="Spending">
            {spending.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Not spending">
            {other.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </optgroup>
        </select>
        <span id={`${id}-cat`} className="sr-only">
          Category
        </span>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={choice.remember}
            onChange={(e) => onChange({ remember: e.target.checked })}
            className="size-4 accent-[var(--accent)]"
          />
          Remember for future imports
        </label>
      </div>
    </li>
  );
}
