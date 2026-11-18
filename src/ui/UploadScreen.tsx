import { useId, useState, type DragEvent } from 'react';
import { UnsupportedFormatError } from '../core/import.ts';

/** Larger than any plausible statement export; protects the tab from reading huge files. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

interface UploadScreenProps {
  /** Imports the file's text. Throwing shows the error and lets the person try another file. */
  onImport: (text: string) => Promise<void>;
}

function errorMessage(error: unknown): string {
  if (error instanceof UnsupportedFormatError) {
    return 'Spendio can’t read this file yet. It reads CSV exports from Nordea, so check that you exported your transactions as CSV rather than PDF.';
  }
  return `This file couldn’t be imported: ${error instanceof Error ? error.message : String(error)}`;
}

export function UploadScreen({ onImport }: UploadScreenProps) {
  const inputId = useId();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function handle(file: File | undefined) {
    if (!file || busy) return;
    setError(null);
    if (file.size === 0) return setError('This file is empty. Export your transactions again and choose the new file.');
    if (file.size > MAX_FILE_BYTES) return setError('This file is larger than 10 MB, which is too big for a bank statement export.');
    setBusy(true);
    try {
      await onImport(await file.text());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    void handle(e.dataTransfer.files[0]);
  }

  return (
    <section aria-labelledby="upload-title">
      <h1 id="upload-title" className="text-title font-semibold tracking-[-0.015em]">
        Add a bank statement
      </h1>
      <p className="mt-4 max-w-prose text-ink-muted">
        Export your transactions as a CSV file from your internet bank. Spendio reads it here on this device and sorts
        every purchase into a category. The file is never sent anywhere.
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        data-testid="drop-zone"
        className={`mt-10 flex flex-col items-start gap-4 rounded-xl border-2 border-dashed px-6 py-10 sm:items-center sm:text-center ${
          dragging ? 'border-accent bg-surface-raised' : 'border-line'
        }`}
      >
        <label
          htmlFor={inputId}
          className={`cursor-pointer rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-ink ${busy ? 'opacity-40' : ''}`}
        >
          {busy ? 'Reading file…' : 'Choose a CSV file'}
        </label>
        <input
          id={inputId}
          type="file"
          accept=".csv,text/csv"
          disabled={busy}
          className="sr-only"
          onChange={(e) => {
            void handle(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <p className="text-sm text-ink-muted">or drop it here. Works with Nordea CSV exports.</p>
      </div>

      {error && (
        <p role="alert" className="mt-6 max-w-prose font-medium text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
