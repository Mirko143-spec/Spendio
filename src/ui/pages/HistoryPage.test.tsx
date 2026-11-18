// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CATEGORY_IDS as C } from '../../core/categories.ts';
import { openStore, type SpendioStore } from '../../storage/store.ts';
import { StoreContext } from '../useStore.ts';
import { HistoryPage } from './HistoryPage.tsx';

const fixture = readFileSync(join(import.meta.dirname, '../../../fixtures/nordea-sample.csv'), 'utf8');
let store: SpendioStore;
let name: string;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-18T12:00:00Z')); // today is in the November 2026 period
  window.location.hash = '#/history';
  name = `spendio-history-${crypto.randomUUID()}`;
  store = await openStore(name);
});
afterEach(async () => {
  vi.useRealTimers();
  // Unmount before closing: this hook runs before the shared cleanup(), and a page still
  // mounted would reload from a closed database.
  cleanup();
  store.close();
  await Dexie.delete(name);
  window.location.hash = '';
});

function renderPage() {
  render(
    <StoreContext.Provider value={store}>
      <HistoryPage />
    </StoreContext.Provider>,
  );
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

const importFixture = () => store.importCsv(fixture, { now: '2026-11-18T12:00:00.000Z', newId: () => crypto.randomUUID() });

describe('HistoryPage', () => {
  it('invites a first statement when there is no data', async () => {
    renderPage();
    expect(await screen.findByText('Nothing to compare yet.', { exact: false })).toBeInTheDocument();
  });

  it('shows six periods ending today, and suggests setting limits when there are none', async () => {
    await importFixture();
    renderPage();
    expect(await screen.findByRole('heading', { name: 'June 2026 – November 2026' })).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader')).toHaveLength(7);
    expect(screen.getByRole('link', { name: 'Set limits' })).toHaveAttribute('href', '#/categories');
    expect(screen.getByRole('button', { name: '‹ Earlier' })).toBeDisabled(); // nothing before October
  });

  it('moves the window and keeps it in the URL', async () => {
    await importFixture();
    const user = renderPage();
    await user.click(await screen.findByRole('button', { name: 'Later ›' }));
    // Stops at January 2027, the last period with data, instead of paging into empty months.
    expect(screen.getByRole('heading', { name: 'August 2026 – January 2027' })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/history?end=2027-01');
    expect(screen.getByRole('button', { name: 'Later ›' })).toBeDisabled();
  });

  it('marks months over the limit that applied then', async () => {
    await importFixture();
    await store.setBudgetLimit(C.groceries, 50000, '2026-10', () => crypto.randomUUID());
    renderPage();
    const groceries = (await screen.findByRole('rowheader', { name: /^Groceries/ })).closest('tr')!;
    expect(within(groceries).getByRole('rowheader')).toHaveTextContent('Within the limit every month');
    expect(screen.queryByRole('link', { name: 'Set limits' })).not.toBeInTheDocument();
  });
});
