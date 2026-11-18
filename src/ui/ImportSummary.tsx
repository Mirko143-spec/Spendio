import type { ImportResult } from '../core/import.ts';

interface ImportSummaryProps {
  result: Pick<ImportResult, 'format' | 'batch' | 'errors'>;
  /** Transactions waiting in review after this import (may include earlier imports). */
  reviewCount: number;
  onReview: () => void;
  onDone: () => void;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** What an import did: new rows, rows already imported, rows that couldn't be read (docs/SPEC.md §8). */
export function ImportSummary({ result, reviewCount, onReview, onDone }: ImportSummaryProps) {
  const { format, batch, errors } = result;
  const nothingNew = batch.newCount === 0;

  return (
    <section aria-labelledby="summary-title">
      <h1 id="summary-title" className="text-title font-semibold tracking-[-0.015em]">
        {nothingNew ? 'Nothing new in this file' : `Imported ${plural(batch.newCount, 'transaction', 'transactions')}`}
      </h1>
      <p className="mt-4 max-w-prose text-ink-muted">
        {nothingNew
          ? `Every transaction in this ${format.name} file was already imported, so nothing changed.`
          : `From your ${format.name} statement.`}
      </p>

      <dl className="mt-10 divide-y divide-line border-y border-line">
        <Row label="New" value={batch.newCount} />
        <Row label="Already imported, skipped" value={batch.duplicateCount} />
        {batch.errorCount > 0 && <Row label="Lines that couldn’t be read" value={batch.errorCount} />}
      </dl>

      {errors.length > 0 && (
        <div className="mt-6">
          <p className="max-w-prose text-sm text-ink-muted">
            These lines were skipped. The rest of the file was imported as usual.
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {errors.map((e) => (
              <li key={e.line}>
                Line {e.line}: {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
        {reviewCount > 0 ? (
          <>
            <button type="button" onClick={onDone} className="rounded-lg px-4 py-2.5 font-medium text-ink-muted hover:text-ink">
              Review later
            </button>
            <button
              type="button"
              onClick={onReview}
              className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-ink"
            >
              Review {plural(reviewCount, 'transaction', 'transactions')}
            </button>
          </>
        ) : (
          <button type="button" onClick={onDone} className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-ink">
            Done
          </button>
        )}
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-4">
      <dt>{label}</dt>
      <dd className="text-amount font-semibold">{value}</dd>
    </div>
  );
}
