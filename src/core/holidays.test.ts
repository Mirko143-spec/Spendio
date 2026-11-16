import { describe, expect, it } from 'vitest';
import { easterSunday, isBankingDay, lastBankingDayOnOrBefore, swedishHolidays } from './holidays.ts';

const holiday = (year: number, name: string) => swedishHolidays(year).find((h) => h.name === name)?.date;

describe('easterSunday', () => {
  it.each([
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2027, '2027-03-28'],
    [2028, '2028-04-16'],
    [2038, '2038-04-25'], // latest possible date
    [2285, '2285-03-22'], // earliest possible date
  ])('%i → %s', (year, date) => {
    expect(easterSunday(year)).toBe(date);
  });
});

describe('swedishHolidays', () => {
  it('lists all 16 bank holidays in date order', () => {
    const list = swedishHolidays(2026);
    expect(list).toHaveLength(16);
    expect(list.map((h) => h.date)).toEqual([...list.map((h) => h.date)].sort());
  });

  it.each([
    [2026, 'Långfredagen', '2026-04-03'],
    [2026, 'Annandag påsk', '2026-04-06'],
    [2026, 'Kristi himmelsfärdsdag', '2026-05-14'],
    [2027, 'Kristi himmelsfärdsdag', '2027-05-06'],
    [2025, 'Midsommarafton', '2025-06-20'],
    [2026, 'Midsommarafton', '2026-06-19'],
    [2027, 'Midsommarafton', '2027-06-25'],
    [2028, 'Midsommarafton', '2028-06-23'],
    [2027, 'Midsommardagen', '2027-06-26'],
    [2026, 'Alla helgons dag', '2026-10-31'],
    [2027, 'Alla helgons dag', '2027-11-06'],
  ])('%i %s is %s', (year, name, date) => {
    expect(holiday(year, name)).toBe(date);
  });
});

describe('isBankingDay', () => {
  it.each([
    ['2026-11-25', true, 'ordinary Wednesday'],
    ['2026-10-24', false, 'Saturday'],
    ['2026-10-25', false, 'Sunday'],
    ['2026-12-24', false, 'Julafton (Thursday)'],
    ['2026-12-25', false, 'Juldagen (Friday)'],
    ['2026-12-31', false, 'Nyårsafton'],
    ['2026-01-06', false, 'Trettondedag jul'],
    ['2026-06-19', false, 'Midsommarafton'],
    ['2026-06-18', true, 'day before Midsommarafton'],
  ])('%s → %s (%s)', (date, expected) => {
    expect(isBankingDay(date)).toBe(expected);
  });
});

describe('lastBankingDayOnOrBefore (payday examples)', () => {
  it.each([
    ['2026-11-25', '2026-11-25', 'the 25th is a Wednesday'],
    ['2026-10-25', '2026-10-23', 'the 25th is a Sunday → Friday'],
    ['2026-12-25', '2026-12-23', 'Juldagen and Julafton → the 23rd'],
    ['2027-12-25', '2027-12-23', 'Saturday, with Julafton on Friday → Thursday'],
    ['2027-06-25', '2027-06-24', 'Midsommarafton on the 25th → Thursday'],
    ['2028-06-25', '2028-06-22', 'Sunday, with Midsommarafton on Friday the 23rd → Thursday'],
    ['2027-01-01', '2026-12-30', 'Nyårsdagen and Nyårsafton → Dec 30'],
  ])('%s → %s (%s)', (date, expected) => {
    expect(lastBankingDayOnOrBefore(date)).toBe(expected);
  });
});
