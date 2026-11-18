import { useId, useState } from 'react';

/** Wipes everything on this device after an explicit, inline confirmation (no browser dialogs). */
export function DeleteAllData({ onDelete }: { onDelete: () => Promise<void> }) {
  const id = useId();
  const [confirming, setConfirming] = useState(false);

  return (
    <section aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="text-lg font-semibold">
        Delete all data
      </h2>
      <p className="mt-1 max-w-prose text-sm text-ink-muted">
        Removes everything Spendio has stored in this browser and starts fresh.
      </p>
      {confirming ? (
        <div role="group" aria-labelledby={`${id}-ask`} className="mt-3 rounded-lg border border-danger/40 bg-surface-raised p-4">
          <p id={`${id}-ask`} className="font-medium">
            Delete everything on this device?
          </p>
          <p className="mt-1 max-w-prose text-sm text-ink-muted">
            All transactions, imports, categories you added or changed, rules and limits are deleted. This can’t be
            undone, so download a backup first if you might want any of it back.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => void onDelete()}
              className="rounded-lg bg-danger px-4 py-1.5 font-semibold text-surface"
            >
              Delete everything
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
          className="mt-3 rounded-lg border border-danger/40 px-4 py-1.5 font-medium text-danger"
        >
          Delete all data…
        </button>
      )}
    </section>
  );
}
