import { useId, useState } from 'react';
import type { CsvMapping } from '../core/csv/mapping.ts';
import { dateRange } from './format.ts';

/** Layouts set up with the CSV mapper, each of which can be forgotten (docs/SPEC.md §4.2). */
export function FileLayoutsSection({
  mappings,
  onForget,
}: {
  mappings: readonly CsvMapping[];
  onForget: (id: string) => Promise<void>;
}) {
  const id = useId();
  return (
    <section aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="text-lg font-semibold">
        File layouts
      </h2>
      <p className="mt-1 max-w-prose text-sm text-ink-muted">
        Layouts you set up for banks Spendio doesn’t know yet. Files with the same layout import directly.
      </p>
      {mappings.length === 0 ? (
        <p className="mt-4 text-ink-muted">None yet. They’re created when you add a file from another bank.</p>
      ) : (
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {mappings.map((m) => (
            <LayoutRow key={m.id} mapping={m} onForget={onForget} />
          ))}
        </ul>
      )}
    </section>
  );
}

function LayoutRow({ mapping, onForget }: { mapping: CsvMapping; onForget: (id: string) => Promise<void> }) {
  const id = useId();
  const [confirming, setConfirming] = useState(false);
  const created = mapping.createdAt.slice(0, 10);

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="font-medium">{mapping.name}</span>
        <span className="text-sm text-ink-muted">set up {dateRange(created, created)}</span>
      </div>
      {confirming ? (
        <div role="group" aria-labelledby={`${id}-ask`} className="mt-3 rounded-lg border border-line bg-surface-raised p-3">
          <p id={`${id}-ask`} className="font-medium">
            Forget the {mapping.name} layout?
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            Transactions you already imported stay. The next {mapping.name} file asks you to set up the layout again.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => void onForget(mapping.id)}
              className="rounded-lg bg-danger px-4 py-1.5 font-semibold text-surface"
            >
              Forget layout
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="text-ink-muted hover:text-ink">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label={`Forget the ${mapping.name} layout`}
          className="mt-1.5 text-sm font-medium text-ink-muted hover:text-danger"
        >
          Forget
        </button>
      )}
    </li>
  );
}
