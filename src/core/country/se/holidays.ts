import { addDays, isoDate, weekday } from '../../dates.ts';

/**
 * Swedish banking days (docs/SPEC.md §9). Computed locally, no API.
 *
 * Banks are closed on weekends, public holidays, and the de facto bank holidays
 * Midsommarafton, Julafton and Nyårsafton.
 */

export interface Holiday {
  date: string;
  name: string;
}

/** Easter Sunday, using the anonymous Gregorian algorithm (Meeus/Jones/Butcher). */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return isoDate(year, month, day)!;
}

/** First date from `from` (inclusive) that falls on `targetWeekday` (0 = Sunday … 6 = Saturday). */
function nextWeekday(from: string, targetWeekday: number): string {
  return addDays(from, (targetWeekday - weekday(from) + 7) % 7);
}

const FRIDAY = 5;
const SATURDAY = 6;

/** All Swedish public holidays and bank holidays in `year`, sorted by date. */
export function swedishHolidays(year: number): Holiday[] {
  const easter = easterSunday(year);
  const fixed = (month: number, day: number) => isoDate(year, month, day)!;

  const holidays: Holiday[] = [
    { date: fixed(1, 1), name: 'Nyårsdagen' },
    { date: fixed(1, 6), name: 'Trettondedag jul' },
    { date: addDays(easter, -2), name: 'Långfredagen' },
    { date: easter, name: 'Påskdagen' },
    { date: addDays(easter, 1), name: 'Annandag påsk' },
    { date: fixed(5, 1), name: 'Första maj' },
    { date: addDays(easter, 39), name: 'Kristi himmelsfärdsdag' },
    { date: addDays(easter, 49), name: 'Pingstdagen' },
    { date: fixed(6, 6), name: 'Sveriges nationaldag' },
    { date: nextWeekday(fixed(6, 19), FRIDAY), name: 'Midsommarafton' },
    { date: nextWeekday(fixed(6, 20), SATURDAY), name: 'Midsommardagen' },
    { date: nextWeekday(fixed(10, 31), SATURDAY), name: 'Alla helgons dag' },
    { date: fixed(12, 24), name: 'Julafton' },
    { date: fixed(12, 25), name: 'Juldagen' },
    { date: fixed(12, 26), name: 'Annandag jul' },
    { date: fixed(12, 31), name: 'Nyårsafton' },
  ];
  return holidays.sort((x, y) => x.date.localeCompare(y.date));
}

const cache = new Map<number, Set<string>>();

function holidayDates(year: number): Set<string> {
  let dates = cache.get(year);
  if (!dates) {
    dates = new Set(swedishHolidays(year).map((h) => h.date));
    cache.set(year, dates);
  }
  return dates;
}

export function isBankingDay(iso: string): boolean {
  const day = weekday(iso);
  if (day === 0 || day === SATURDAY) return false;
  return !holidayDates(Number(iso.slice(0, 4))).has(iso);
}

/** `iso` itself if it's a banking day, otherwise the closest banking day before it. */
export function lastBankingDayOnOrBefore(iso: string): string {
  let date = iso;
  while (!isBankingDay(date)) date = addDays(date, -1);
  return date;
}
