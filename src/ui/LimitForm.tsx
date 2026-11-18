import { useId, useState, type FormEvent } from 'react';
import { parseAmount, type Ore } from '../core/money.ts';

/** Enter, change or remove a monthly limit in kronor (accepts Swedish formatting like "1 500,50"). */
export function LimitForm({
  current,
  onSave,
  onCancel,
}: {
  current: Ore | null;
  onSave: (amount: Ore | null) => Promise<void>;
  onCancel: () => void;
}) {
  const id = useId();
  const [value, setValue] = useState(current === null ? '' : String(current / 100).replace('.', ','));
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    let amount: Ore;
    try {
      amount = parseAmount(value.replace(/\s*kr\s*$/i, ''));
    } catch {
      return setError('Enter an amount in kronor, e.g. 1500 or 1 500,50.');
    }
    if (amount <= 0) return setError('Enter an amount above 0, or remove the limit.');
    await onSave(amount);
  }

  return (
    <form onSubmit={submit} className="mt-3 flex flex-wrap items-center gap-3">
      <label htmlFor={id} className="sr-only">
        Monthly limit in kronor
      </label>
      <input
        id={id}
        inputMode="decimal"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Monthly limit, kr"
        aria-invalid={error !== null}
        aria-describedby={error ? `${id}-error` : undefined}
        className="w-40 rounded-lg border border-line bg-surface-raised px-3 py-1.5"
      />
      <button type="submit" className="rounded-lg bg-accent px-4 py-1.5 font-semibold text-accent-ink">
        Save limit
      </button>
      {current !== null && (
        <button type="button" onClick={() => void onSave(null)} className="text-sm font-medium text-ink-muted hover:text-ink">
          Remove limit
        </button>
      )}
      <button type="button" onClick={onCancel} className="text-sm font-medium text-ink-muted hover:text-ink">
        Cancel
      </button>
      {error && (
        <p id={`${id}-error`} role="alert" className="w-full text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </form>
  );
}

