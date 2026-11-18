import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { DEFAULT_ACCOUNT } from '../core/account.ts';
import { DEFAULT_CATEGORIES } from '../core/categories.ts';
import { DEFAULT_SETTINGS } from '../core/settings.ts';
import { openStore } from './store.ts';
import { freshStore } from './testing.ts';

describe('openStore', () => {
  it('seeds default categories, settings and account on first open', async () => {
    await using store = await freshStore();
    expect(await store.listCategories()).toEqual(expect.arrayContaining([...DEFAULT_CATEGORIES]));
    expect(await store.listCategories()).toHaveLength(DEFAULT_CATEGORIES.length);
    expect(await store.getSettings()).toEqual(DEFAULT_SETTINGS);
    expect(await store.listAccounts()).toEqual([DEFAULT_ACCOUNT]);
  });

  it('does not seed again when an existing database is reopened', async () => {
    const name = `spendio-test-${crypto.randomUUID()}`;
    const first = await openStore(name);
    await first.db.categories.delete('gaming'); // a user change
    first.close();

    const second = await openStore(name);
    const ids = (await second.listCategories()).map((c) => c.id);
    expect(ids).not.toContain('gaming');
    expect(ids).toHaveLength(DEFAULT_CATEGORIES.length - 1);
    second.close();
    await Dexie.delete(name);
  });

  it('keeps separate databases isolated', async () => {
    await using a = await freshStore();
    await using b = await freshStore();
    await a.db.categories.delete('gaming');
    expect((await b.listCategories()).map((c) => c.id)).toContain('gaming');
  });
});
