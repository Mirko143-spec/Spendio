import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CsvMapping } from '../core/csv/mapping.ts';
import { UnsupportedFormatError } from '../core/import.ts';
import { freshStore } from './testing.ts';

const fixture = readFileSync(join(import.meta.dirname, '../../fixtures/generic-sample.csv'), 'utf8');
let seq = 0;
const ctx = (now = '2026-11-18T10:00:00.000Z') => ({ now, newId: () => `id-${++seq}` });
const TESTBANK: CsvMapping = {
  id: 'm1',
  headerSignature: 'date,description,reference,debit,credit,balance',
  name: 'Testbank',
  delimiter: ',',
  dateFormat: 'DD/MM/YYYY',
  decimal: '.',
  columns: { date: 0, description: [1], debit: 3, credit: 4, balance: 5 },
  createdAt: '2026-11-18T00:00:00.000Z',
};

describe('CSV mappings in the store', () => {
  it('rejects an unknown layout until it is mapped, then imports it like any bank', async () => {
    await using store = await freshStore();
    await expect(store.importCsv(fixture, ctx())).rejects.toThrow(UnsupportedFormatError);

    await store.saveCsvMapping(TESTBANK);
    const result = await store.importCsv(fixture, ctx());
    expect(result.batch).toMatchObject({ newCount: 9, label: 'Testbank · 2026-11-18' });
    expect(await store.listAccounts()).toEqual([{ id: 'account:csv:m1', bank: 'csv:m1', name: 'Testbank' }]);

    // The next file with the same layout needs no mapping step.
    const again = await store.importCsv(fixture, ctx('2026-11-19T10:00:00.000Z'));
    expect(again.batch).toMatchObject({ newCount: 0, duplicateCount: 9 });
  });

  it('keeps one mapping per layout, and trims the bank name', async () => {
    await using store = await freshStore();
    await store.saveCsvMapping({ ...TESTBANK, name: '  Testbank  ' });
    await store.saveCsvMapping({ ...TESTBANK, id: 'm2', name: 'Testbank 2', createdAt: '2026-11-19T00:00:00.000Z' });
    expect((await store.listCsvMappings()).map((m) => [m.id, m.name])).toEqual([['m2', 'Testbank 2']]);
  });

  it('requires a bank name', async () => {
    await using store = await freshStore();
    await expect(store.saveCsvMapping({ ...TESTBANK, name: ' ' })).rejects.toThrow(/name/);
  });

  it('forgets a layout but keeps what was imported with it', async () => {
    await using store = await freshStore();
    await store.saveCsvMapping(TESTBANK);
    await store.importCsv(fixture, ctx());
    await store.deleteCsvMapping('m1');
    expect(await store.listCsvMappings()).toEqual([]);
    expect(await store.countTransactions()).toBe(9);
    await expect(store.importCsv(fixture, ctx())).rejects.toThrow(UnsupportedFormatError);
  });

  it('round-trips mappings through backups', async () => {
    await using store = await freshStore();
    await store.saveCsvMapping(TESTBANK);
    const backup = await store.exportBackup('2026-11-18T12:00:00.000Z');
    await store.wipeAll();
    await store.restoreBackup(backup);
    expect(await store.listCsvMappings()).toEqual([TESTBANK]);
  });
});
