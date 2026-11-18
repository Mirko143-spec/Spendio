// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CATEGORY_IDS as C } from '../../core/categories.ts';
import { limitFor } from '../../core/budgets.ts';
import { openStore, type SpendioStore } from '../../storage/store.ts';
import { StoreContext } from '../useStore.ts';
import { OverviewPage } from './OverviewPage.tsx';

const fixture = readFileSync(join(import.meta.dirname, '../../../fixtures/nordea-sample.csv'), 'utf8');
let store: SpendioStore;
let name: string;

beforeEach(async () => {
  // "Today" is Dec 1 2026: the December period (Nov 25 – Dec 22) has data.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-12-01T12:00:00Z'));
  name = `spendio-overview-${crypto.randomUUID()}`;
  store = await openStore(name);
});
afterEach(async () => {
  vi.useRealTimers();
  store.close();
  await Dexie.delete(name);
});

const renderPage = () =>
  render(
    <StoreContext.Provider value={store}>
      <OverviewPage />
    </StoreContext.Provider>,
  );

describe('OverviewPage', () => {
  it('invites a first statement when there is no data', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'No transactions yet' })).toBeInTheDocument();
  });

  it('opens on today’s period with headlines, budgets, chart and the review notice', async () => {
    await store.importCsv(fixture, { now: '2026-12-01T12:00:00.000Z', newId: () => crypto.randomUUID() });
    renderPage();
    expect(await screen.findByRole('heading', { name: 'December 2026' })).toBeInTheDocument();
    expect(screen.getByText(/6 transactions are waiting/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Review them' })).toHaveAttribute('href', '#/review');
    expect(screen.getByRole('heading', { name: 'Budgets' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Spending by category' })).toBeInTheDocument();
  });

  it('moves between periods', async () => {
    await store.importCsv(fixture, { now: '2026-12-01T12:00:00.000Z', newId: () => crypto.randomUUID() });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Previous period: November 2026' }));
    expect(screen.getByRole('heading', { name: 'November 2026' })).toBeInTheDocument();
    expect(screen.getByText('23 Oct – 24 Nov')).toBeInTheDocument();
  });

  it('saves a limit from the budget list, from the shown period on', async () => {
    await store.importCsv(fixture, { now: '2026-12-01T12:00:00.000Z', newId: () => crypto.randomUUID() });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage();
    await user.selectOptions(await screen.findByLabelText('Set a limit for another category'), C.groceries);
    await user.type(screen.getByLabelText('Monthly limit in kronor'), '2000');
    await user.click(screen.getByRole('button', { name: 'Save limit' }));

    await vi.waitFor(async () => expect(limitFor(await store.listBudgets(), C.groceries, '2026-12')).toBe(200000));
    expect(limitFor(await store.listBudgets(), C.groceries, '2026-11')).toBeNull();
    expect(await screen.findByText(/of 2 000 kr|of 2\u00A0000 kr/)).toBeInTheDocument();
  });
});

describe('OverviewPage with sample data', () => {
  it('says it is sample data, and removes it on request', async () => {
    await store.loadSampleData(fixture, { now: '2026-12-01T12:00:00.000Z', newId: () => crypto.randomUUID() });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage();
    expect(await screen.findByRole('note')).toHaveTextContent('You’re exploring sample data');
    await user.click(screen.getByRole('button', { name: 'Remove sample data' }));
    await vi.waitFor(() => expect(window.location.hash).toBe('#/add'));
    expect(await store.countTransactions()).toBe(0);
  });

  it('shows no sample notice for your own imports', async () => {
    await store.importCsv(fixture, { now: '2026-12-01T12:00:00.000Z', newId: () => crypto.randomUUID() });
    renderPage();
    expect(await screen.findByRole('heading', { name: 'December 2026' })).toBeInTheDocument();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });
});
