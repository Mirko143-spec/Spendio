import { describe, expect, it } from 'vitest';
import { parseDateAs } from './date-formats.ts';

describe('parseDateAs', () => {
  it.each([
    ['2026-11-03', 'YYYY-MM-DD', '2026-11-03'],
    ['2026/11/03', 'YYYY/MM/DD', '2026-11-03'],
    ['20261103', 'YYYYMMDD', '2026-11-03'],
    ['03/11/2026', 'DD/MM/YYYY', '2026-11-03'],
    ['3.11.2026', 'DD.MM.YYYY', '2026-11-03'],
    ['03-11-2026', 'DD-MM-YYYY', '2026-11-03'],
    ['11/03/2026', 'MM/DD/YYYY', '2026-11-03'],
  ] as const)('%s as %s → %s', (value, format, expected) => {
    expect(parseDateAs(value, format)).toBe(expected);
  });

  it('rejects values that do not fit the format or do not exist', () => {
    expect(parseDateAs('2026-11-03', 'DD/MM/YYYY')).toBeUndefined();
    expect(parseDateAs('31/02/2026', 'DD/MM/YYYY')).toBeUndefined();
    expect(parseDateAs('13/13/2026', 'MM/DD/YYYY')).toBeUndefined();
    expect(parseDateAs('', 'YYYY-MM-DD')).toBeUndefined();
  });
});
