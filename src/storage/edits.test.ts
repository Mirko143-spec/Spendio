import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATEGORY_IDS as C } from '../core/categories.ts';
import { freshStore } from './testing.ts';

const fixture = readFileSync(join(import.meta.dirname, '../../fixtures/nordea-sample.csv'), 'utf8');
let seq = 0;
const newId = () => `id-${++seq}`;

async function importedStore() {
  const store = await freshStore();
  await store.importCsv(fixture, { now: '2026-12-29T10:00:00.000Z', newId });
  return store;
}

describe('setTransactionCategory', () => {
  it('stores a manual choice and clears the suggestion flag', async () => {
    await using store = await importedStore();
    const swish = (await store.listTransactions()).find((t) => t.suggested)!;
    await store.setTransactionCategory(swish.id, C.restaurants);
    expect(await store.db.transactions.get(swish.id)).toMatchObject({
      categoryId: C.restaurants,
      categorySource: 'manual',
      suggested: false,
    });
  });

  it('puts a transaction back in Needs review with null', async () => {
    await using store = await importedStore();
    const t = (await store.listTransactions())[0]!;
    await store.setTransactionCategory(t.id, null);
    expect(await store.db.transactions.get(t.id)).toMatchObject({ categoryId: null, categorySource: 'none' });
  });

  it('keeps a manual choice when the same file is imported again', async () => {
    await using store = await importedStore();
    const t = (await store.listTransactions()).find((x) => x.merchantKey === 'SPOTIFY')!;
    await store.setTransactionCategory(t.id, C.entertainment);
    await store.importCsv(fixture, { now: '2026-12-30T10:00:00.000Z', newId });
    expect(await store.db.transactions.get(t.id)).toMatchObject({ categoryId: C.entertainment });
  });

  it('rejects unknown transactions and categories', async () => {
    await using store = await importedStore();
    const t = (await store.listTransactions())[0]!;
    await expect(store.setTransactionCategory(t.id, 'nope')).rejects.toThrow(/Unknown category/);
    await expect(store.setTransactionCategory('nope', C.other)).rejects.toThrow(/Unknown transaction/);
  });
});

describe('addCategory / updateCategory', () => {
  it('adds a spending category with a normalized color', async () => {
    await using store = await freshStore();
    const pets = await store.addCategory({ name: '  Pets ', color: '#AABBCC' }, newId);
    expect(pets).toMatchObject({ name: 'Pets', color: '#aabbcc', type: 'spending', system: false });
    expect(await store.listCategories()).toContainEqual(pets);
  });

  it('rejects empty, duplicate (case-insensitive) names and bad colors', async () => {
    await using store = await freshStore();
    await expect(store.addCategory({ name: ' ', color: '#000000' }, newId)).rejects.toThrow(/required/);
    await expect(store.addCategory({ name: 'groceries', color: '#000000' }, newId)).rejects.toThrow(/already exists/);
    await expect(store.addCategory({ name: 'Pets', color: 'red' }, newId)).rejects.toThrow(/Invalid color/);
  });

  it('renames and recolors, including system categories, without changing type', async () => {
    await using store = await freshStore();
    const renamed = await store.updateCategory(C.income, { name: 'Inkomst', color: '#111111' });
    expect(renamed).toMatchObject({ id: C.income, name: 'Inkomst', color: '#111111', type: 'income', system: true });
  });

  it('allows keeping the same name in a different case', async () => {
    await using store = await freshStore();
    await expect(store.updateCategory(C.gaming, { name: 'GAMING' })).resolves.toMatchObject({ name: 'GAMING' });
    await expect(store.updateCategory(C.gaming, { name: 'Groceries' })).rejects.toThrow(/already exists/);
  });
});

describe('deleteCategory', () => {
  it('moves transactions and rules, and removes budget limits', async () => {
    await using store = await importedStore();
    await store.db.rules.add({ id: 'u1', source: 'user', op: 'equals', value: 'X', categoryId: C.gaming, createdAt: '2026-12-01' });
    await store.db.budgets.add({ id: 'b1', categoryId: C.gaming, amount: 100000, effectiveFrom: '2026-11' });
    const gamingCount = (await store.listTransactions()).filter((t) => t.categoryId === C.gaming).length;
    expect(gamingCount).toBe(3); // Steam + 2 × Roblox

    await store.deleteCategory(C.gaming, C.entertainment);

    const all = await store.listTransactions();
    expect(all.filter((t) => t.categoryId === C.gaming)).toHaveLength(0);
    expect(all.filter((t) => t.categoryId === C.entertainment)).toHaveLength(gamingCount);
    expect(await store.db.rules.get('u1')).toMatchObject({ categoryId: C.entertainment });
    expect(await store.db.budgets.get('b1')).toBeUndefined();
    expect((await store.listCategories()).map((c) => c.id)).not.toContain(C.gaming);
  });

  it('refuses to delete system categories or move into itself or an unknown category', async () => {
    await using store = await freshStore();
    await expect(store.deleteCategory(C.income, C.other)).rejects.toThrow(/can't be deleted/);
    await expect(store.deleteCategory(C.gaming, C.gaming)).rejects.toThrow(/Invalid category/);
    await expect(store.deleteCategory(C.gaming, 'nope')).rejects.toThrow(/Invalid category/);
    expect((await store.listCategories()).map((c) => c.id)).toContain(C.gaming);
  });
});

describe('importing after deleting a default category', () => {
  it('sends purchases for the deleted category to Needs review instead of a category that is gone', async () => {
    await using store = await freshStore();
    await store.deleteCategory(C.travel, C.other);
    const csv =
      '﻿Bokföringsdag;Belopp;Avsändare;Mottagare;Namn;Rubrik;Saldo;Valuta;\n' +
      '2026/11/20;-1200,00;000000-0000;;;Kortköp 261119 SAS SCANDINAVIAN;100,00;SEK;';
    await store.importCsv(csv, { now: '2026-11-20T10:00:00.000Z', newId });
    expect((await store.listTransactions())[0]).toMatchObject({ categoryId: null, categorySource: 'none' });
  });
});

describe('listCategories', () => {
  it('lists categories alphabetically, including new ones and Swedish letters', async () => {
    await using store = await freshStore();
    await store.addCategory({ name: 'Älg & vilt', color: '#000000' }, newId);
    await store.addCategory({ name: 'Bilar', color: '#000000' }, newId);
    const names = (await store.listCategories()).map((c) => c.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'sv')));
    expect(names.indexOf('Bilar')).toBeLessThan(names.indexOf('Entertainment'));
    expect(names.at(-1)).toBe('Älg & vilt');
  });
});
