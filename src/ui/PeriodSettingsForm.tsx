import { useId, useState, type FormEvent } from 'react';
import { periodOf, periodRange, type PeriodSettings } from '../core/periods.ts';
import { dateRange, periodName } from './format.ts';

interface PeriodSettingsFormProps {
  settings: PeriodSettings;
  /** ISO date used for the preview ("today"). */
  today: string;
  onSave: (settings: PeriodSettings) => Promise<void>;
}

/** When a budget month starts (docs/SPEC.md §9), with a preview of the period it gives today. */
export function PeriodSettingsForm({ settings, today, onSave }: PeriodSettingsFormProps) {
  const id = useId();
  const [startDay, setStartDay] = useState(settings.startDay);
  const [adjust, setAdjust] = useState(settings.adjustToBankingDay);
  const [saved, setSaved] = useState(false);
  const draft = { startDay, adjustToBankingDay: adjust };
  const preview = periodRange(periodOf(today, draft), draft);
  const changed = startDay !== settings.startDay || adjust !== settings.adjustToBankingDay;

  async function submit(e: FormEvent) {
    e.preventDefault();
    await onSave(draft);
    setSaved(true);
  }

  return (
    <form onSubmit={submit} aria-labelledby={`${id}-title`} className="space-y-4">
      <div>
        <h2 id={`${id}-title`} className="text-lg font-semibold">
          Budget month
        </h2>
        <p className="mt-1 max-w-prose text-sm text-ink-muted">
          When a new budget month starts. In Sweden that’s usually payday, the 25th. Changing it just regroups your
          transactions; nothing is lost.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor={`${id}-day`}>Starts on day</label>
        <select
          id={`${id}-day`}
          value={startDay}
          onChange={(e) => {
            setStartDay(Number(e.target.value));
            setSaved(false);
          }}
          className="rounded-lg border border-line bg-surface-raised px-3 py-1.5"
        >
          {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              {d === 1 ? '1 (calendar months)' : d}
            </option>
          ))}
        </select>
      </div>

      <label className={`flex items-center gap-2 ${startDay === 1 ? 'text-ink-muted' : ''}`}>
        <input
          type="checkbox"
          checked={adjust}
          disabled={startDay === 1}
          onChange={(e) => {
            setAdjust(e.target.checked);
            setSaved(false);
          }}
          className="size-4 accent-[var(--accent)]"
        />
        Move to the previous banking day on weekends and holidays
      </label>

      <p className="text-sm" aria-live="polite">
        This month would be <strong className="font-semibold">{periodName(preview.label)}</strong>:{' '}
        {dateRange(preview.start, preview.end)}.
      </p>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={!changed}
          className="rounded-lg bg-accent px-4 py-1.5 font-semibold text-accent-ink disabled:opacity-40"
        >
          Save budget month
        </button>
        {saved && !changed && (
          <span role="status" className="text-sm text-ink-muted">
            Saved
          </span>
        )}
      </div>
    </form>
  );
}
