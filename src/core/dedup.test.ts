import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseNordeaCsv } from './formats/nordea/parse.ts';
import type { ParsedRow } from './csv/types.ts';
import { dedupRows, fingerprintRows } from './dedup.ts';

const ACCOUNT = 'nordea-personkonto';
const fixtureRows = parseNordeaCsv(
  readFileSync(join(import.meta.dirname, '../../fixtures/nordea-sample.csv'), 'utf8'),
).rows;

const fingerprints = (rows: readonly ParsedRow[], account = ACCOUNT) =>
  new Set(fingerprintRows(account, rows).map((r) => r.fingerprint));

const row = (overrides: Partial<ParsedRow> = {}): ParsedRow => ({
  line: 2,
  bookingDate: '2026-11-03',
  amount: -6500,
  description: 'Kortköp 261102 ROBLOX.COM 188885825',
  currency: 'SEK',
  ...overrides,
});

describe('dedupRows on the fixture', () => {
  it('imports every row the first time, including both identical Roblox rows', () => {
    const { fresh, duplicateCount } = dedupRows(ACCOUNT, fixtureRows, new Set());
    expect(fresh).toHaveLength(28);
    expect(duplicateCount).toBe(0);
    expect(new Set(fresh.map((r) => r.fingerprint)).size).toBe(28);
    expect(fresh.filter((r) => r.description.includes('ROBLOX'))).toHaveLength(2);
  });

  it('imports nothing when the same file is uploaded again', () => {
    expect(dedupRows(ACCOUNT, fixtureRows, fingerprints(fixtureRows))).toEqual({ fresh: [], duplicateCount: 28 });
  });

  it('only adds the new rows from an overlapping, later export', () => {
    // Earlier export: the 20 oldest rows. Later export: everything (newest first, as Nordea lists them).
    const earlier = fixtureRows.slice(8);
    const { fresh, duplicateCount } = dedupRows(ACCOUNT, fixtureRows, fingerprints(earlier));
    expect(fresh.map((r) => r.description)).toEqual(fixtureRows.slice(0, 8).map((r) => r.description));
    expect(duplicateCount).toBe(20);
  });

  it('ignores line numbers, which differ between exports', () => {
    const shifted = fixtureRows.map((r) => ({ ...r, line: r.line + 100 }));
    expect(dedupRows(ACCOUNT, shifted, fingerprints(fixtureRows)).fresh).toEqual([]);
  });
});

describe('dedupRows without a balance column', () => {
  const noBalance = (n: number) => Array.from({ length: n }, () => row());

  it('keeps identical rows within one file', () => {
    expect(dedupRows(ACCOUNT, noBalance(2), new Set()).fresh).toHaveLength(2);
  });

  it('adds only the extra copies when a later file has more of the same row', () => {
    const { fresh, duplicateCount } = dedupRows(ACCOUNT, noBalance(3), fingerprints(noBalance(2)));
    expect(fresh).toHaveLength(1);
    expect(duplicateCount).toBe(2);
  });

  it('adds nothing when a later file has fewer copies', () => {
    expect(dedupRows(ACCOUNT, noBalance(1), fingerprints(noBalance(2))).fresh).toEqual([]);
  });
});

describe('fingerprints', () => {
  it('differ by account, date, amount, description and balance', () => {
    const base = fingerprintRows(ACCOUNT, [row({ balance: 100 })])[0]!.fingerprint;
    const variants = [
      fingerprintRows('other-account', [row({ balance: 100 })]),
      fingerprintRows(ACCOUNT, [row({ balance: 100, bookingDate: '2026-11-04' })]),
      fingerprintRows(ACCOUNT, [row({ balance: 100, amount: -6501 })]),
      fingerprintRows(ACCOUNT, [row({ balance: 100, description: 'Kortköp 261102 STEAM' })]),
      fingerprintRows(ACCOUNT, [row({ balance: 101 })]),
      fingerprintRows(ACCOUNT, [row()]),
    ].map((r) => r[0]!.fingerprint);
    for (const v of variants) expect(v).not.toBe(base);
  });

  it('ignore whitespace differences in the description', () => {
    const a = fingerprintRows(ACCOUNT, [row({ description: 'Kortköp  261102 ROBLOX.COM 188885825 ' })]);
    const b = fingerprintRows(ACCOUNT, [row()]);
    expect(a[0]!.fingerprint).toBe(b[0]!.fingerprint);
  });

  it('keep the row data and file order', () => {
    const result = fingerprintRows(ACCOUNT, fixtureRows);
    expect(result).toEqual(fixtureRows.map((r) => expect.objectContaining(r)));
    expect(result.every((r) => typeof r.fingerprint === 'string')).toBe(true);
  });
});
