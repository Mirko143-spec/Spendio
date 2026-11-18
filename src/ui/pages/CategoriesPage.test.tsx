// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { limitFor } from '../../core/budgets.ts';
import { CATEGORY_IDS as C } from '../../core/categories.ts';
import { openStore, type SpendioStore } from '../../storage/store.ts';
import { StoreContext } from '../useStore.ts';
import { CategoriesPage } from './CategoriesPage.tsx';

const fixture = readFileSync(join(import.meta.dirname, '../../../fixtures/nordea-sample.csv'), 'utf8');
let store: SpendioStore;
let name: string;
const ctx = () => ({ now: '2026-11-18T12:00:00.000Z', newId: () => crypto.randomUUID() });

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-18T12:00:00Z')); // November 2026 period
  name = `spendio-categories-${crypto.randomUUID()}`;
  store = await openStore(name);
  await store.importCsv(fixture, ctx());
  await store.saveUserRule({ op: 'equals', value: 'TEBEX.ORG', categoryId: C.gaming }, ctx());
});
afterEach(async () => {
  vi.useRealTimers();
  // Unmount before closing: this hook runs before the shared cleanup(), and a page still
  // mounted would reload from a closed database.
  cleanup();
  store.close();
  await Dexie.delete(name);
});

function renderPage() {
  render(
    <StoreContext.Provider value={store}>
      <CategoriesPage />
    </StoreContext.Provider>,
  );
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}
const row = async (categoryName: string) =>
  (await screen.findByText(categoryName, { selector: 'span.font-medium' })).closest('li')!;

describe('CategoriesPage', () => {
  it('adds and renames categories, saved to storage', async () => {
    const user = renderPage();
    await user.type(await screen.findByLabelText('Name of the new category'), 'Pets');
    await user.click(screen.getByRole('button', { name: 'Add category' }));
    await user.click(within(await row('Pets')).getByRole('button', { name: 'Rename' }));
    await user.clear(screen.getByLabelText('New name for Pets'));
    await user.type(screen.getByLabelText('New name for Pets'), 'Pets & vet');
    await user.click(screen.getByRole('button', { name: 'Save name' }));
    expect(await row('Pets & vet')).toBeInTheDocument();
    expect((await store.listCategories()).some((c) => c.name === 'Pets & vet')).toBe(true);
  });

  it('sets a limit from the current period on', async () => {
    const user = renderPage();
    await user.click(within(await row('Groceries')).getByRole('button', { name: 'Set a monthly limit' }));
    await user.type(screen.getByLabelText('Monthly limit in kronor'), '2000');
    await user.click(screen.getByRole('button', { name: 'Save limit' }));
    await vi.waitFor(async () => expect(limitFor(await store.listBudgets(), C.groceries, '2026-11')).toBe(200000));
    expect(limitFor(await store.listBudgets(), C.groceries, '2026-10')).toBeNull();
  });

  it('deletes a category, moving its transactions to the chosen one', async () => {
    const user = renderPage();
    const gaming = await row('Gaming');
    expect(within(gaming).getByText('3 transactions')).toBeInTheDocument();
    await user.click(within(gaming).getByRole('button', { name: 'Delete' }));
    await user.selectOptions(screen.getByLabelText('Move its 3 transactions and 1 rule to'), C.entertainment);
    await user.click(screen.getByRole('button', { name: 'Delete Gaming' }));

    await vi.waitFor(() => expect(screen.queryByText('Gaming', { selector: 'span.font-medium' })).not.toBeInTheDocument());
    const moved = (await store.listTransactions()).filter((t) => t.merchantKey === 'ROBLOX.COM');
    expect(moved.map((t) => t.categoryId)).toEqual([C.entertainment, C.entertainment]);
    expect((await store.listUserRules())[0]).toMatchObject({ value: 'TEBEX.ORG', categoryId: C.entertainment });
  });

  it('changes and deletes your rules', async () => {
    const user = renderPage();
    const select = await screen.findByRole('combobox', { name: 'Category for rule: Merchant is exactly TEBEX.ORG' });
    await user.selectOptions(select, C.entertainment);
    await vi.waitFor(async () => expect((await store.listUserRules())[0]).toMatchObject({ categoryId: C.entertainment }));
    expect(await store.listUserRules()).toHaveLength(1); // updated, not duplicated

    await user.click(screen.getByRole('button', { name: 'Delete rule: Merchant is exactly TEBEX.ORG' }));
    expect(await screen.findByText('No rules yet.')).toBeInTheDocument();
    expect(await store.listUserRules()).toEqual([]);
  });
});
