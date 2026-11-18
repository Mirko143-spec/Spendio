// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openStore, type SpendioStore } from '../../storage/store.ts';
import { plain } from '../../test-utils.ts';
import { StoreContext } from '../useStore.ts';
import { SavingsPage } from './SavingsPage.tsx';

const fixture = readFileSync(join(import.meta.dirname, '../../../fixtures/nordea-sample.csv'), 'utf8');
let store: SpendioStore;
let name: string;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-18T12:00:00Z'));
  window.location.hash = '#/savings';
  name = `spendio-savings-${crypto.randomUUID()}`;
  store = await openStore(name);
});
afterEach(async () => {
  vi.useRealTimers();
  store.close();
  await Dexie.delete(name);
  window.location.hash = '';
});

function renderPage() {
  render(
    <StoreContext.Provider value={store}>
      <SavingsPage />
    </StoreContext.Provider>,
  );
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}
const importFixture = () => store.importCsv(fixture, { now: '2026-11-18T12:00:00.000Z', newId: () => crypto.randomUUID() });
const figure = (label: string) => plain(screen.getByText(label, { selector: 'dt' }).parentElement!.textContent);

describe('SavingsPage', () => {
  it('invites a first statement when there is no data', async () => {
    renderPage();
    expect(await screen.findByText('Nothing to show yet.', { exact: false })).toBeInTheDocument();
  });

  it('totals the window and charts left over and money moved', async () => {
    await importFixture();
    const user = renderPage();
    await user.click(await screen.findByRole('button', { name: 'Later ›' })); // Aug 2026 – Jan 2027
    expect(figure('Left over')).toContain('39 127,54');
    expect(figure('Savings rate')).toContain('94 %');
    expect(figure('Moved to savings')).toContain('8 000,00');
    expect(screen.getByRole('list', { name: 'Left over each period' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Moved to savings each period' })).toBeInTheDocument();
  });

  it('lists the same numbers in a table', async () => {
    await importFixture();
    renderPage();
    const november = (await screen.findByRole('rowheader', { name: 'November 2026' })).closest('tr')!;
    expect(within(november).getAllByRole('cell').map((c) => plain(c.textContent))).toEqual([
      '14 592 kr',
      '200 kr',
      '14 392 kr',
      '99 %',
      '3 000 kr',
    ]);
  });

  it('explains when nothing was moved to savings', async () => {
    await importFixture();
    window.location.hash = '#/savings?end=2026-10';
    renderPage();
    expect(await screen.findByText(/Nothing was moved to savings in these periods/)).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Moved to savings each period' })).not.toBeInTheDocument();
  });
});
