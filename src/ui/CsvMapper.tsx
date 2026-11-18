import { useId, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { parseWithMapping } from '../core/csv/generic.ts';
import { DATE_FORMATS, type ColumnMap, type CsvMapping, type DateFormat, type Delimiter } from '../core/csv/mapping.ts';
import { guessMapping, sniffCsv } from '../core/csv/sniff.ts';
import { Amount } from './Amount.tsx';
import { dateRange } from './format.ts';

interface CsvMapperProps {
  /** The file's text. */
  text: string;
  onSave: (mapping: CsvMapping) => Promise<void>;
  onCancel: () => void;
  newId: () => string;
  now: () => string;
}

const DELIMITER_NAMES: Record<Delimiter, string> = { ',': 'Comma', ';': 'Semicolon', '\t': 'Tab', '|': 'Vertical bar' };
const PREVIEW_ROWS = 5;
const NONE = '';

const control = 'w-full rounded-lg border border-line bg-surface-raised px-3 py-1.5';
const toIndex = (v: string) => (v === NONE ? undefined : Number(v));

/**
 * One-time setup for a CSV layout no bank preset recognizes (docs/SPEC.md §4.2): which column is
 * what, how dates and numbers are written, and the bank's name. Settings start from Spendio's
 * guesses, and a live preview shows exactly how the first rows will import.
 */
export function CsvMapper({ text, onSave, onCancel, newId, now }: CsvMapperProps) {
  const id = useId();
  const detected = useMemo(() => sniffCsv(text), [text]);
  const [delimiter, setDelimiter] = useState<Delimiter>(detected.delimiter);
  const sample = useMemo(() => (delimiter === detected.delimiter ? detected : sniffCsv(text, delimiter)), [text, delimiter, detected]);
  const guess = useMemo(() => guessMapping(sample), [sample]);

  const [name, setName] = useState('');
  const [dateFormat, setDateFormat] = useState<DateFormat>(guess.dateFormat);
  const [decimal, setDecimal] = useState<',' | '.'>(guess.decimal);
  const [columns, setColumns] = useState<Partial<ColumnMap>>(guess.columns);
  const [split, setSplit] = useState(guess.columns.debit !== undefined);
  const [error, setError] = useState<string | null>(null);

  function changeDelimiter(d: Delimiter) {
    setDelimiter(d);
    const g = guessMapping(sniffCsv(text, d));
    setColumns(g.columns);
    setDateFormat(g.dateFormat);
    setDecimal(g.decimal);
    setSplit(g.columns.debit !== undefined);
  }

  const set = (change: Partial<ColumnMap>) => setColumns((c) => ({ ...c, ...change }));
  const option = (i: number) => {
    const example = sample.rows.map((r) => r[i]).find((v) => v);
    const label = sample.header[i] || `Column ${i + 1}`;
    return `${label}${example ? `, e.g. ${example.length > 24 ? `${example.slice(0, 24)}…` : example}` : ''}`;
  };

  const complete: ColumnMap | null =
    columns.date !== undefined &&
    columns.description !== undefined &&
    columns.description.length > 0 &&
    (split ? columns.debit !== undefined || columns.credit !== undefined : columns.amount !== undefined)
      ? {
          date: columns.date,
          description: columns.description,
          ...(split
            ? {
                ...(columns.debit !== undefined ? { debit: columns.debit } : {}),
                ...(columns.credit !== undefined ? { credit: columns.credit } : {}),
              }
            : { amount: columns.amount! }),
          ...(columns.balance !== undefined ? { balance: columns.balance } : {}),
        }
      : null;

  const draft: CsvMapping | null = complete && {
    id: 'draft',
    headerSignature: sample.signature,
    name,
    delimiter,
    dateFormat,
    decimal,
    columns: complete,
    createdAt: '',
  };
  // Re-parsed on every change: a bank export is at most a few thousand lines, which takes milliseconds.
  const preview = draft ? parseWithMapping(text, draft) : null;
  const canSave = Boolean(draft && name.trim() && preview && preview.rows.length > 0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!draft || !canSave) return;
    setError(null);
    try {
      await onSave({ ...draft, id: newId(), name: name.trim(), createdAt: now() });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const columnSelect = (label: string, value: number | undefined, onChange: (v: number | undefined) => void, optional = false) => (
    <Field id={`${id}-${label}`} label={label}>
      <select id={`${id}-${label}`} className={control} value={value ?? NONE} onChange={(e) => onChange(toIndex(e.target.value))}>
        <option value={NONE}>{optional ? 'None' : 'Choose a column'}</option>
        {sample.header.map((_, i) => (
          <option key={i} value={i}>
            {option(i)}
          </option>
        ))}
      </select>
    </Field>
  );

  return (
    <form onSubmit={submit} aria-labelledby={`${id}-title`} className="space-y-10">
      <div>
        <h1 id={`${id}-title`} className="text-title font-semibold tracking-[-0.015em]">
          Set up this file’s layout
        </h1>
        <p className="mt-4 max-w-prose text-ink-muted">
          Spendio doesn’t know this bank’s export yet. Tell it once which column is what, and every later file with the
          same layout imports automatically. Spendio has filled in its best guesses.
        </p>
      </div>

      <section aria-label="The file" className="space-y-3">
        <h2 className="font-semibold">The file</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                {sample.header.map((h, i) => (
                  <th key={i} scope="col" className="border-b border-line px-2 py-1.5 text-left font-semibold whitespace-nowrap">
                    {h || `Column ${i + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sample.rows.slice(0, 3).map((row, r) => (
                <tr key={r}>
                  {row.map((v, i) => (
                    <td key={i} className="border-b border-line px-2 py-1.5 whitespace-nowrap text-ink-muted">
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-label="Columns" className="space-y-4">
        <h2 className="font-semibold">Columns</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {columnSelect('Date', columns.date, (v) => set({ date: v }))}
          {columnSelect('Description', columns.description?.[0], (v) =>
            set({ description: v === undefined ? [] : [v, ...(columns.description?.slice(1) ?? [])] }),
          )}
          {columnSelect('More description (optional)', columns.description?.[1], (v) =>
            set({ description: [...(columns.description?.slice(0, 1) ?? []), ...(v === undefined ? [] : [v])] }), true,
          )}
          {columnSelect('Balance (optional)', columns.balance, (v) => set({ balance: v }), true)}
        </div>

        <fieldset className="space-y-3">
          <legend className="text-sm text-ink-muted">Amounts are in</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name={`${id}-split`} checked={!split} onChange={() => setSplit(false)} className="accent-[var(--accent)]" />
            One column (negative = money out)
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name={`${id}-split`} checked={split} onChange={() => setSplit(true)} className="accent-[var(--accent)]" />
            Separate columns for money out and money in
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            {split ? (
              <>
                {columnSelect('Money out', columns.debit, (v) => set({ debit: v }), true)}
                {columnSelect('Money in', columns.credit, (v) => set({ credit: v }), true)}
              </>
            ) : (
              columnSelect('Amount', columns.amount, (v) => set({ amount: v }))
            )}
          </div>
        </fieldset>
      </section>

      <section aria-label="Formats" className="space-y-4">
        <h2 className="font-semibold">Formats</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id={`${id}-dateformat`} label="Dates look like">
            <select id={`${id}-dateformat`} className={control} value={dateFormat} onChange={(e) => setDateFormat(e.target.value as DateFormat)}>
              {DATE_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </Field>
          <Field id={`${id}-decimal`} label="Decimals are written with">
            <select id={`${id}-decimal`} className={control} value={decimal} onChange={(e) => setDecimal(e.target.value as ',' | '.')}>
              <option value=",">A comma (1 234,50)</option>
              <option value=".">A dot (1,234.50)</option>
            </select>
          </Field>
          <Field id={`${id}-delimiter`} label="Columns are separated by">
            <select id={`${id}-delimiter`} className={control} value={delimiter} onChange={(e) => changeDelimiter(e.target.value as Delimiter)}>
              {(Object.keys(DELIMITER_NAMES) as Delimiter[]).map((d) => (
                <option key={d} value={d}>
                  {DELIMITER_NAMES[d]}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      <section aria-label="Preview" className="space-y-3">
        <h2 className="font-semibold">Preview</h2>
        {!preview ? (
          <p className="text-ink-muted">Choose the date, description and amount columns to see a preview.</p>
        ) : (
          <>
            <ul className="divide-y divide-line border-y border-line">
              {preview.rows.slice(0, PREVIEW_ROWS).map((r) => (
                <li key={r.line} className="flex items-baseline justify-between gap-4 py-2">
                  <span className="min-w-0">
                    <span className="block break-words">{r.description}</span>
                    <span className="text-sm text-ink-muted">{dateRange(r.bookingDate, r.bookingDate)}</span>
                  </span>
                  <Amount ore={r.amount} />
                </li>
              ))}
            </ul>
            {preview.errors.length > 0 && (
              <div role="alert" className="text-sm">
                <p className="font-medium text-danger">
                  {preview.errors.length} of {preview.rows.length + preview.errors.length} lines can’t be read with these
                  settings:
                </p>
                <ul className="mt-1 text-ink-muted">
                  {preview.errors.slice(0, 3).map((e) => (
                    <li key={e.line}>
                      Line {e.line}: {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>

      <section aria-label="Bank" className="space-y-3">
        <Field id={`${id}-name`} label="Which bank is this?">
          <input
            id={`${id}-name`}
            className={`${control} sm:max-w-64`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. SEB"
          />
        </Field>
      </section>

      {error && (
        <p role="alert" className="font-medium text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
        <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2.5 font-medium text-ink-muted hover:text-ink">
          Cancel
        </button>
        <button
          type="submit"
          disabled={!canSave}
          className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-ink disabled:opacity-40"
        >
          Save and import
        </button>
      </div>
    </form>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block text-sm text-ink-muted">
        {label}
      </label>
      {children}
    </div>
  );
}
