import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { CATEGORY_IDS as C, DEFAULT_CATEGORIES } from '../core/categories.ts';
import { openStore } from './store.ts';

/** Creates a database exactly as schema v1 left it: default categories without "Swish from people". */
async function createV1Database(name: string, removeIds: string[] = []): Promise<void> {
  const v1 = new Dexie(name);
  v1.version(1).stores({
    accounts: 'id',
    importBatches: 'id, accountId, importedAt',
    transactions: 'id, accountId, importBatchId, &fingerprint, effectiveDate, categoryId, merchantKey',
    categories: 'id',
    rules: 'id, categoryId',
    budgets: 'id, categoryId, effectiveFrom',
    csvMappings: 'id, &headerSignature',
    settings: 'key',
  });
  await v1.open();
  const skip = new Set([C.swishFromPeople, ...removeIds]);
  await v1.table('categories').bulkAdd(DEFAULT_CATEGORIES.filter((c) => !skip.has(c.id)));
  v1.close();
}

describe('schema v2 upgrade', () => {
  it('adds "Swish from people" to databases created before it existed', async () => {
    const name = `spendio-migration-${crypto.randomUUID()}`;
    await createV1Database(name);
    const store = await openStore(name);
    expect((await store.listCategories()).map((c) => c.id)).toContain(C.swishFromPeople);
    expect(await store.listCategories()).toHaveLength(DEFAULT_CATEGORIES.length);
    store.close();
    await Dexie.delete(name);
  });

  it('does not bring back defaults the person deleted', async () => {
    const name = `spendio-migration-${crypto.randomUUID()}`;
    await createV1Database(name, [C.gaming]);
    const store = await openStore(name);
    const ids = (await store.listCategories()).map((c) => c.id);
    expect(ids).toContain(C.swishFromPeople);
    expect(ids).not.toContain(C.gaming);
    store.close();
    await Dexie.delete(name);
  });
});
