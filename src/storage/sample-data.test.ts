import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { freshStore } from './testing.ts';

const sample = readFileSync(join(import.meta.dirname, '../../fixtures/nordea-sample.csv'), 'utf8');
const real = [
  '﻿Bokföringsdag;Belopp;Avsändare;Mottagare;Namn;Rubrik;Saldo;Valuta;',
  '2026/11/20;-1200,00;000000-0000;;;Kortköp 261119 SAS SCANDINAVIAN;100,00;SEK;',
].join('\n');
let seq = 0;
const ctx = () => ({ now: '2026-11-19T10:00:00.000Z', newId: () => `id-${++seq}` });

describe('sample data', () => {
  it('loads as an import labelled "Sample data"', async () => {
    await using store = await freshStore();
    const result = await store.loadSampleData(sample, ctx());
    expect(result.batch).toMatchObject({ label: 'Sample data', newCount: 28 });
    expect(await store.listImportBatches()).toEqual([expect.objectContaining({ label: 'Sample data' })]);
  });

  it('removes only the sample data, keeping your own imports', async () => {
    await using store = await freshStore();
    await store.loadSampleData(sample, ctx());
    await store.importCsv(real, ctx());
    expect(await store.removeSampleData()).toBe(28);
    expect(await store.countTransactions()).toBe(1);
    expect((await store.listImportBatches()).map((b) => b.label)).toEqual(['Nordea · 2026-11-19']);
  });

  it('removes nothing when there is no sample data', async () => {
    await using store = await freshStore();
    expect(await store.removeSampleData()).toBe(0);
  });
});
