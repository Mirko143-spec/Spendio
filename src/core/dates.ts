/** Calendar-date helpers on ISO `YYYY-MM-DD` strings. All math is in UTC, so time zones never shift a date. */

const MS_PER_DAY = 86_400_000;

/** Builds an ISO date, or returns undefined if the date doesn't exist (e.g. Feb 30). */
export function isoDate(year: number, month: number, day: number): string | undefined {
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return undefined;
  return d.toISOString().slice(0, 10);
}

function toUtcMs(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

/** `iso` shifted by `days` (may be negative). */
export function addDays(iso: string, days: number): string {
  return new Date(toUtcMs(iso) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Day of the week: 0 = Sunday … 6 = Saturday. */
export function weekday(iso: string): number {
  return new Date(toUtcMs(iso)).getUTCDay();
}

/** Whole days from `from` to `to` (positive if `to` is later). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / MS_PER_DAY);
}
