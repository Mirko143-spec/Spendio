import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATEGORY_IDS } from '../core/categories.ts';
import { periodRange } from '../core/periods.ts';
import type { ImportContext } from './store.ts';
import { freshStore } from './testing.ts';

const fixture = readFileSync(join(import.meta.dirname, '../../fixtures/nordea-sample.csv'), 'utf8');

let seq = 0;
const context = (now = '2026-12-29T10:00:00.000Z'): ImportContext => ({ now, newId: () => `id-${++seq}` });

describe('importNordea', () => {
  it('stores all rows and the batch on the first import', async () => {
    await using store = await freshStore();
    const result = await store.importNordea(fixture, context());
    expect(result.batch).toMatchObject({ newCount: 28, duplicateCount: 0, errorCount: 0 });
    expect(await store.listTransactions()).toHaveLength(28);
    expect(await store.listImportBatches()).toEqual([result.batch]);
  });

  it('adds nothing and stores no empty batch when the same file is imported again', async () => {
    await using store = await freshStore();
    await store.importNordea(fixture, context('2026-12-29T10:00:00.000Z'));
    const again = await store.importNordea(fixture, context('2026-12-30T10:00:00.000Z'));
    expect(again.batch).toMatchObject({ newCount: 0, duplicateCount: 28 });
    expect(await store.listTransactions()).toHaveLength(28);
    expect(await store.listImportBatches()).toHaveLength(1);
  });

  it('only adds the newer rows of an overlapping export', async () => {
    await using store = await freshStore();
    const lines = fixture.split('\n');
    const olderExport = [lines[0], ...lines.slice(9)].join('\n'); // header + the 20 oldest rows
    await store.importNordea(olderExport, context('2026-12-01T10:00:00.000Z'));
    const later = await store.importNordea(fixture, context('2026-12-29T10:00:00.000Z'));
    expect(later.batch).toMatchObject({ newCount: 8, duplicateCount: 20 });
    expect(await store.listTransactions()).toHaveLength(28);
  });

  it('applies stored user rules', async () => {
    await using store = await freshStore();
    await store.db.rules.add({
      id: 'u1',
      source: 'user',
      op: 'equals',
      value: 'EXEMPELBUTIKEN AB',
      categoryId: CATEGORY_IDS.shopping,
      createdAt: '2026-12-01T00:00:00.000Z',
    });
    await store.importNordea(fixture, context());
    const swish = (await store.listTransactions()).find((t) => t.merchantKey === 'EXEMPELBUTIKEN AB');
    expect(swish).toMatchObject({ categoryId: CATEGORY_IDS.shopping, categorySource: 'user_rule' });
  });

  it('saves nothing when the write fails part-way', async () => {
    await using store = await freshStore();
    await store.importNordea(fixture, context());
    const before = await store.listTransactions();
    // Simulate a race: wipe the fingerprint read so dedup misses, then let the unique index reject the write.
    const original = store.db.transactions.orderBy.bind(store.db.transactions);
    store.db.transactions.orderBy = ((index: string) => {
      const collection = original(index);
      return Object.assign(collection, { keys: async () => [] });
    }) as typeof store.db.transactions.orderBy;
    await expect(store.importNordea(fixture, context('2026-12-31T10:00:00.000Z'))).rejects.toThrow();
    expect(await store.listTransactions()).toEqual(before);
    expect(await store.listImportBatches()).toHaveLength(1);
  });
});

describe('listTransactions', () => {
  it('filters by an inclusive date range, oldest first', async () => {
    await using store = await freshStore();
    await store.importNordea(fixture, context());
    const november = periodRange('2026-11'); // Oct 23 – Nov 24
    const rows = await store.listTransactions(november);
    expect(rows).toHaveLength(17);
    expect(rows[0]!.effectiveDate).toBe('2026-10-23');
    expect(rows.at(-1)!.effectiveDate).toBe('2026-11-24');
    const dates = rows.map((r) => r.effectiveDate);
    expect([...dates].sort()).toEqual(dates);
  });
});

describe('deleteImportBatch', () => {
  it('removes the batch and only its transactions', async () => {
    await using store = await freshStore();
    const lines = fixture.split('\n');
    const first = await store.importNordea([lines[0], ...lines.slice(9)].join('\n'), context('2026-12-01T10:00:00.000Z'));
    const second = await store.importNordea(fixture, context('2026-12-29T10:00:00.000Z'));

    expect(await store.deleteImportBatch(second.batch.id)).toBe(8);
    expect(await store.listTransactions()).toHaveLength(20);
    expect((await store.listImportBatches()).map((b) => b.id)).toEqual([first.batch.id]);
  });

  it('lets the same rows be imported again after undo', async () => {
    await using store = await freshStore();
    const { batch } = await store.importNordea(fixture, context());
    await store.deleteImportBatch(batch.id);
    const again = await store.importNordea(fixture, context('2026-12-30T10:00:00.000Z'));
    expect(again.batch.newCount).toBe(28);
  });
});
