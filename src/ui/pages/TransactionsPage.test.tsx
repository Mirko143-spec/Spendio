// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CATEGORY_IDS as C } from '../../core/categories.ts';
import { openStore, type SpendioStore } from '../../storage/store.ts';
import { StoreContext } from '../useStore.ts';
import { TransactionsPage } from './TransactionsPage.tsx';

const fixture = readFileSync(join(import.meta.dirname, '../../../fixtures/nordea-sample.csv'), 'utf8');
let store: SpendioStore;
let name: string;

beforeEach(async () => {
  name = `spendio-transactions-${crypto.randomUUID()}`;
  store = await openStore(name);
  await store.importCsv(fixture, { now: '2026-12-01T12:00:00.000Z', newId: () => crypto.randomUUID() });
});
afterEach(async () => {
  store.close();
  await Dexie.delete(name);
  window.location.hash = '';
});

const renderPage = (hash = '#/transactions') => {
  window.location.hash = hash;
  return render(
    <StoreContext.Provider value={store}>
      <TransactionsPage />
    </StoreContext.Provider>,
  );
};

describe('TransactionsPage', () => {
  it('lists every transaction without filters', async () => {
    renderPage();
    expect(await screen.findByText('28 transactions')).toBeInTheDocument();
  });

  it('reads filters from the URL, as dashboard links set them', async () => {
    renderPage('#/transactions?category=gaming&period=2026-11');
    expect(await screen.findByText('3 transactions')).toBeInTheDocument();
    expect(screen.getByLabelText('Category')).toHaveValue(C.gaming);
    expect(screen.getByLabelText('Period')).toHaveValue('2026-11');
  });

  it('writes filter changes back to the URL', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(await screen.findByLabelText('Search'), 'roblox');
    expect(window.location.hash).toBe('#/transactions?q=roblox');
    expect(screen.getByText('2 transactions')).toBeInTheDocument();
  });

  it('saves a change for all from a merchant and shows the result', async () => {
    const user = userEvent.setup();
    renderPage('#/transactions?q=roblox');
    const [first] = await screen.findAllByRole('combobox', { name: 'Category for ROBLOX.COM' });
    await user.selectOptions(first!, C.entertainment);
    await user.click(screen.getByRole('button', { name: 'All from ROBLOX.COM' }));

    await vi.waitFor(async () => {
      const roblox = (await store.listTransactions()).filter((t) => t.merchantKey === 'ROBLOX.COM');
      expect(roblox.map((t) => t.categoryId)).toEqual([C.entertainment, C.entertainment]);
    });
    for (const select of await screen.findAllByRole('combobox', { name: 'Category for ROBLOX.COM' })) {
      await vi.waitFor(() => expect(select).toHaveValue(C.entertainment));
    }
    expect(await store.listUserRules()).toEqual([expect.objectContaining({ value: 'ROBLOX.COM' })]);
  });

  it('shows Needs review, and moves a transaction out of it with "Only this one"', async () => {
    const user = userEvent.setup();
    renderPage('#/transactions?category=needs-review');
    expect(await screen.findByText('6 transactions')).toBeInTheDocument();
    const shop = screen.getByRole('combobox', { name: 'Category for EXEMPELSHOP' });
    await user.selectOptions(shop, C.shopping);
    await user.click(within(shop.closest('li')!).getByRole('button', { name: 'Only this one' }));
    expect(await screen.findByText('5 transactions')).toBeInTheDocument();
  });
});
