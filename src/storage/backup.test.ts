import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_ACCOUNT } from '../core/account.ts';
import { parseBackup, serializeBackup, type Backup } from '../core/backup.ts';
import { CATEGORY_IDS as C, DEFAULT_CATEGORIES } from '../core/categories.ts';
import { DEFAULT_SETTINGS } from '../core/settings.ts';
import type { SpendioStore } from './store.ts';
import { freshStore } from './testing.ts';

const fixture = readFileSync(join(import.meta.dirname, '../../fixtures/nordea-sample.csv'), 'utf8');
let seq = 0;
const newId = () => `id-${++seq}`;
const NOW = '2026-12-29T10:00:00.000Z';

/** A store with an import, a manual edit, a custom category, a rule, a budget and changed settings. */
async function populate(store: SpendioStore): Promise<void> {
  await store.importCsv(fixture, { now: NOW, newId });
  const t = (await store.listTransactions())[0]!;
  await store.setTransactionCategory(t.id, C.entertainment);
  await store.addCategory({ name: 'Pets', color: '#123456' }, newId);
  await store.saveUserRule({ op: 'equals', value: 'TEBEX.ORG', categoryId: C.gaming }, { now: NOW, newId });
  await store.setBudgetLimit(C.gaming, 100000, '2026-12', newId);
  await store.savePeriodSettings({ startDay: 1 });
}

/** Backup contents with every list sorted by id, so table order doesn't matter. */
function normalized(backup: Backup) {
  const byId = <T extends { id: string }>(xs: T[]) => [...xs].sort((a, b) => a.id.localeCompare(b.id));
  const d = backup.data;
  return {
    ...d,
    accounts: byId(d.accounts),
    importBatches: byId(d.importBatches),
    transactions: byId(d.transactions),
    categories: byId(d.categories),
    rules: byId(d.rules),
    budgets: byId(d.budgets),
    csvMappings: byId(d.csvMappings),
  };
}

describe('exportBackup → wipeAll → restoreBackup', () => {
  it('round-trips everything exactly, through the serialized file', async () => {
    await using store = await freshStore();
    await populate(store);
    const exported = await store.exportBackup(NOW);
    expect(exported.data.transactions).toHaveLength(28);

    await store.wipeAll();
    await store.restoreBackup(parseBackup(serializeBackup(exported)));

    expect(normalized(await store.exportBackup(NOW))).toEqual(normalized(exported));
  });

  it('restoring into another store replaces what was there', async () => {
    await using source = await freshStore();
    await populate(source);
    const backup = await source.exportBackup(NOW);

    await using target = await freshStore();
    await target.addCategory({ name: 'Will be gone', color: '#000000' }, newId);
    await target.restoreBackup(backup);
    const names = (await target.listCategories()).map((c) => c.name);
    expect(names).toContain('Pets');
    expect(names).not.toContain('Will be gone');
  });
});

describe('restoreBackup atomicity', () => {
  it('leaves existing data untouched when the restore fails', async () => {
    await using store = await freshStore();
    await populate(store);
    const before = normalized(await store.exportBackup(NOW));

    const broken = await store.exportBackup(NOW);
    broken.data.transactions.push({ ...broken.data.transactions[0]!, id: 'dup' }); // violates unique fingerprint
    await expect(store.restoreBackup(broken)).rejects.toThrow();

    expect(normalized(await store.exportBackup(NOW))).toEqual(before);
  });
});

describe('wipeAll', () => {
  it('leaves only the defaults of a fresh install', async () => {
    await using store = await freshStore();
    await populate(store);
    await store.wipeAll();
    expect(await store.listTransactions()).toEqual([]);
    expect(await store.listImportBatches()).toEqual([]);
    expect(await store.listUserRules()).toEqual([]);
    expect(await store.listBudgets()).toEqual([]);
    expect(await store.listAccounts()).toEqual([DEFAULT_ACCOUNT]);
    expect(await store.listCategories()).toHaveLength(DEFAULT_CATEGORIES.length);
    expect(await store.getSettings()).toEqual(DEFAULT_SETTINGS);
  });
});
