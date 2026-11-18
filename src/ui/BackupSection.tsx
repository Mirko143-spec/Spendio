import { useId, useState } from 'react';
import { parseBackup, type Backup } from '../core/backup.ts';
import { dateRange } from './format.ts';

interface BackupSectionProps {
  /** Downloads a backup of everything on this device. */
  onExport: () => Promise<void>;
  /** Replaces everything on this device with the (already validated) backup. */
  onRestore: (backup: Backup) => Promise<void>;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Export a backup file, or restore one (docs/SPEC.md §14 Backup format). */
export function BackupSection({ onExport, onRestore }: BackupSectionProps) {
  const id = useId();
  const [pending, setPending] = useState<Backup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function choose(file: File | undefined) {
    if (!file) return;
    setError(null);
    setStatus(null);
    try {
      setPending(parseBackup(await file.text()));
    } catch (e) {
      setPending(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function restore() {
    if (!pending) return;
    await onRestore(pending);
    setPending(null);
    setStatus('Backup restored.');
  }

  return (
    <section aria-labelledby={`${id}-title`} className="space-y-4">
      <div>
        <h2 id={`${id}-title`} className="text-lg font-semibold">
          Backup
        </h2>
        <p className="mt-1 max-w-prose text-sm text-ink-muted">
          Your data lives only in this browser. Download a backup to keep a copy or to move to another browser or
          computer. The file contains your bank transactions and isn’t encrypted, so keep it somewhere safe.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => {
            setStatus(null);
            void onExport().then(() => setStatus('Backup downloaded.'));
          }}
          className="rounded-lg bg-accent px-4 py-1.5 font-semibold text-accent-ink"
        >
          Download backup
        </button>
        <label htmlFor={`${id}-file`} className="cursor-pointer font-medium text-accent hover:underline">
          Restore from a backup file
        </label>
        <input
          id={`${id}-file`}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          onChange={(e) => {
            void choose(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>

      {pending && (
        <div role="group" aria-labelledby={`${id}-confirm`} className="rounded-lg border border-line bg-surface-raised p-4">
          <p id={`${id}-confirm`} className="font-medium">
            Restore the backup from {dateRange(pending.exportedAt.slice(0, 10), pending.exportedAt.slice(0, 10))}?
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            It has {plural(pending.data.transactions.length, 'transaction', 'transactions')},{' '}
            {plural(pending.data.categories.length, 'category', 'categories')} and{' '}
            {plural(pending.data.rules.length, 'rule', 'rules')}. Everything currently on this device is replaced.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => void restore()}
              className="rounded-lg bg-danger px-4 py-1.5 font-semibold text-surface"
            >
              Replace my data
            </button>
            <button type="button" onClick={() => setPending(null)} className="text-ink-muted hover:text-ink">
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="max-w-prose font-medium text-danger">
          {error}
        </p>
      )}
      {status && (
        <p role="status" className="text-sm text-ink-muted">
          {status}
        </p>
      )}
    </section>
  );
}
