import { useId, useState } from 'react';
import type { Account } from '../core/account.ts';
import type { ImportBatch } from '../core/import.ts';
import { dateRange } from './format.ts';

interface ImportsSectionProps {
  /** Newest first. */
  batches: readonly ImportBatch[];
  accounts: readonly Account[];
  /** Removes a batch and its transactions. */
  onUndo: (batchId: string) => Promise<void>;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Past imports, each of which can be undone (docs/SPEC.md §8). */
export function ImportsSection({ batches, accounts, onUndo }: ImportsSectionProps) {
  const id = useId();
  const names = new Map(accounts.map((a) => [a.id, a.name]));

  return (
    <section aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="text-lg font-semibold">
        Imports
      </h2>
      <p className="mt-1 max-w-prose text-sm text-ink-muted">
        Imported the wrong file? Undo it to remove everything that import added.
      </p>
      {batches.length === 0 ? (
        <p className="mt-4 text-ink-muted">No imports yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {batches.map((b) => (
            <ImportRow key={b.id} batch={b} bank={names.get(b.accountId) ?? 'Bank'} onUndo={onUndo} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ImportRow({ batch, bank, onUndo }: { batch: ImportBatch; bank: string; onUndo: ImportsSectionProps['onUndo'] }) {
  const id = useId();
  const [confirming, setConfirming] = useState(false);
  const date = dateRange(batch.importedAt.slice(0, 10), batch.importedAt.slice(0, 10));
  const title = `${bank}, ${date}`;

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="font-medium">{title}</span>
        <span className="text-sm text-ink-muted">
          {plural(batch.newCount, 'transaction', 'transactions')} added
          {batch.duplicateCount > 0 && `, ${batch.duplicateCount} already there`}
        </span>
      </div>
      {confirming ? (
        <div role="group" aria-labelledby={`${id}-ask`} className="mt-3 rounded-lg border border-line bg-surface-raised p-3">
          <p id={`${id}-ask`} className="font-medium">
            Undo the {title} import?
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            Its {plural(batch.newCount, 'transaction', 'transactions')} are removed, including categories you chose for
            them. Your rules stay. You can import the file again later.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => void onUndo(batch.id)}
              className="rounded-lg bg-danger px-4 py-1.5 font-semibold text-surface"
            >
              Remove this import
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
          aria-label={`Undo the ${title} import`}
          className="mt-1.5 text-sm font-medium text-ink-muted hover:text-danger"
        >
          Undo
        </button>
      )}
    </li>
  );
}
