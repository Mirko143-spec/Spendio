import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATEGORY_IDS as C } from '../core/categories.ts';
import { freshStore } from './testing.ts';

const fixture = readFileSync(join(import.meta.dirname, '../../fixtures/nordea-sample.csv'), 'utf8');
let seq = 0;
const ctx = (now = '2026-12-29T10:00:00.000Z') => ({ now, newId: () => `id-${++seq}` });

async function storeWithFixture() {
  const store = await freshStore();
  await store.importCsv(fixture, ctx());
  const all = await store.listTransactions();
  const find = (merchantKey: string, kind?: string) =>
    all.filter((t) => t.merchantKey === merchantKey && (!kind || t.kind === kind));
  return Object.assign(store, { find });
}

describe('applyCategoryToMerchant', () => {
  it('changes this one and saves a rule for future imports', async () => {
    await using store = await storeWithFixture();
    const [first] = store.find('ROBLOX.COM');
    const changed = await store.applyCategoryToMerchant(first!.id, C.entertainment, { includePast: false }, ctx());
    expect(changed).toBe(1);
    expect(await store.db.transactions.get(first!.id)).toMatchObject({ categoryId: C.entertainment, categorySource: 'user_rule' });
    expect(await store.listUserRules()).toEqual([
      expect.objectContaining({ op: 'equals', value: 'ROBLOX.COM', categoryId: C.entertainment }),
    ]);
    const other = (await store.listTransactions()).find((t) => t.merchantKey === 'ROBLOX.COM' && t.id !== first!.id);
    expect(other).toMatchObject({ categoryId: C.gaming });
  });

  it('also changes earlier ones from the merchant when asked', async () => {
    await using store = await storeWithFixture();
    const [first] = store.find('ROBLOX.COM');
    expect(await store.applyCategoryToMerchant(first!.id, C.entertainment, { includePast: true }, ctx())).toBe(2);
    const roblox = (await store.listTransactions()).filter((t) => t.merchantKey === 'ROBLOX.COM');
    expect(roblox.map((t) => t.categoryId)).toEqual([C.entertainment, C.entertainment]);
  });

  it('never overrides a category the person chose by hand', async () => {
    await using store = await storeWithFixture();
    const [a, b] = store.find('ROBLOX.COM');
    await store.setTransactionCategory(b!.id, C.shopping);
    await store.applyCategoryToMerchant(a!.id, C.entertainment, { includePast: true }, ctx());
    expect(await store.db.transactions.get(b!.id)).toMatchObject({ categoryId: C.shopping, categorySource: 'manual' });
  });

  it('keeps Swish directions separate', async () => {
    await using store = await storeWithFixture();
    const [toAnna] = store.find('ANNA TESTSSON', 'swish_out');
    const [fromAnna] = store.find('ANNA TESTSSON', 'swish_in');
    await store.applyCategoryToMerchant(toAnna!.id, C.restaurants, { includePast: true }, ctx());
    expect(await store.db.transactions.get(fromAnna!.id)).toMatchObject({ categoryId: C.swishFromPeople });
    expect((await store.listUserRules())[0]).toMatchObject({ value: 'ANNA TESTSSON', kind: 'swish_out' });
  });

  it('is applied by the next import', async () => {
    await using store = await storeWithFixture();
    const [shop] = store.find('EXEMPELSHOP');
    await store.applyCategoryToMerchant(shop!.id, C.shopping, { includePast: false }, ctx());
    await store.deleteImportBatch((await store.listImportBatches())[0]!.id);
    await store.importCsv(fixture, ctx('2026-12-30T10:00:00.000Z'));
    expect((await store.listTransactions()).find((t) => t.merchantKey === 'EXEMPELSHOP')).toMatchObject({
      categoryId: C.shopping,
      categorySource: 'user_rule',
    });
  });

  it('rejects unknown transactions and categories without saving a rule', async () => {
    await using store = await storeWithFixture();
    const [shop] = store.find('EXEMPELSHOP');
    await expect(store.applyCategoryToMerchant('nope', C.shopping, { includePast: false }, ctx())).rejects.toThrow(/Unknown transaction/);
    await expect(store.applyCategoryToMerchant(shop!.id, 'nope', { includePast: false }, ctx())).rejects.toThrow(/Unknown category/);
    expect(await store.listUserRules()).toEqual([]);
  });
});
