import { useId, useState, type DragEvent } from 'react';
import { BANK_FORMATS } from '../core/formats/index.ts';
import { UnsupportedFormatError } from '../core/import.ts';
import { listNames } from './format.ts';
import { isPdf, MAX_PDF_PAGES, PdfReadError, readPdfStatement, type PdfProblem } from './pdf.ts';

// A bank can have several layouts (e.g. CSV and PDF); list each bank once.
const SUPPORTED_BANKS = listNames([...new Set(BANK_FORMATS.map((f) => f.name))]);

/** Larger than any plausible statement export; protects the tab from reading huge files. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

interface UploadScreenProps {
  /** Imports the file's text. Throwing shows the error and lets the person try another file. */
  onImport: (text: string) => Promise<void>;
  /** Offered only when there is no data yet: loads made-up transactions to explore with. */
  onTrySample?: () => Promise<void>;
  /** Reads a PDF statement into importable text; defaults to pdf.js. Tests stand in for it. */
  readPdf?: (bytes: Uint8Array) => Promise<string>;
}

const PDF_PROBLEMS: Record<PdfProblem, string> = {
  password: 'This PDF is password-protected. Download it again without a password, or export a CSV file instead.',
  damaged: 'This PDF couldn’t be opened. It may be damaged, so download it again from your internet bank.',
  'no-text':
    'This PDF has no text in it, only images, like a scanned or photographed statement. Download your transactions from your internet bank instead, as a PDF or CSV file.',
  'no-table':
    'Spendio couldn’t find a list of transactions in this PDF. Use the transaction list (account history) from your internet bank, or export a CSV file.',
  'too-long': `This PDF has more than ${MAX_PDF_PAGES} pages, which is too long for a bank statement.`,
};

function errorMessage(error: unknown): string {
  if (error instanceof PdfReadError) return PDF_PROBLEMS[error.problem];
  if (error instanceof UnsupportedFormatError) {
    return `This doesn’t look like a bank statement. Spendio reads CSV files and PDF statements with one transaction per line, so check that you downloaded your transactions rather than another document.`;
  }
  return `This file couldn’t be imported: ${error instanceof Error ? error.message : String(error)}`;
}

export function UploadScreen({ onImport, onTrySample, readPdf = readPdfStatement }: UploadScreenProps) {
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
      const bytes = new Uint8Array(await file.arrayBuffer());
      await onImport(isPdf(bytes) ? await readPdf(bytes) : new TextDecoder().decode(bytes));
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
        Download your transactions from your internet bank as a CSV or PDF file. Spendio reads it here on this device
        and sorts every purchase into a category. The file is never sent anywhere.
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
        {/* The input is visually hidden; its label is the button. The input comes first so the label
            can show the keyboard focus ring when the input is focused (Tailwind `peer`). */}
        <input
          id={inputId}
          type="file"
          accept=".csv,text/csv,.pdf,application/pdf"
          disabled={busy}
          className="peer sr-only"
          onChange={(e) => {
            void handle(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <label
          htmlFor={inputId}
          className={`cursor-pointer rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent ${busy ? 'opacity-40' : ''}`}
        >
          {busy ? 'Reading file…' : 'Choose a CSV or PDF file'}
        </label>
        <p className="text-sm text-ink-muted">or drop it here. {SUPPORTED_BANKS} files import directly; for other banks you set up the layout once.</p>
      </div>

      {onTrySample && (
        <p className="mt-6 text-sm text-ink-muted">
          No statement at hand?{' '}
          <button
            type="button"
            disabled={busy}
            onClick={() => void onTrySample()}
            className="font-medium text-accent underline"
          >
            Try Spendio with sample data
          </button>
          . It loads made-up transactions you can remove again.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-6 max-w-prose font-medium text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
