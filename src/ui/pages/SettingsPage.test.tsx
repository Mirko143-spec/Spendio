// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { serializeBackup } from '../../core/backup.ts';
import { openStore, type SpendioStore } from '../../storage/store.ts';
import { StoreContext } from '../useStore.ts';
import { SettingsPage } from './SettingsPage.tsx';

const fixture = readFileSync(join(import.meta.dirname, '../../../fixtures/nordea-sample.csv'), 'utf8');
let store: SpendioStore;
let name: string;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-12-01T12:00:00Z'));
  window.location.hash = '#/settings';
  name = `spendio-settings-${crypto.randomUUID()}`;
  store = await openStore(name);
  await store.importCsv(fixture, { now: '2026-11-18T12:00:00.000Z', newId: () => crypto.randomUUID() });
});
afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  store.close();
  await Dexie.delete(name);
  window.location.hash = '';
});

function renderPage() {
  render(
    <StoreContext.Provider value={store}>
      <SettingsPage />
    </StoreContext.Provider>,
  );
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

describe('SettingsPage', () => {
  it('saves the budget month', async () => {
    const user = renderPage();
    await user.selectOptions(await screen.findByLabelText('Starts on day'), '1');
    await user.click(screen.getByRole('button', { name: 'Save budget month' }));
    await vi.waitFor(async () => expect((await store.getSettings()).startDay).toBe(1));
  });

  it('downloads a backup file named by date', async () => {
    const createObjectURL = vi.fn(() => 'blob:spendio');
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('spendio-backup-2026-12-01.json');
    });
    const user = renderPage();
    await user.click(await screen.findByRole('button', { name: 'Download backup' }));
    await vi.waitFor(() => expect(click).toHaveBeenCalled());
    const blob = (createObjectURL.mock.calls[0] as unknown as [Blob])[0];
    expect(JSON.parse(await blob.text())).toMatchObject({ app: 'spendio', data: { transactions: expect.any(Array) } });
  });

  it('undoes an import', async () => {
    const user = renderPage();
    await user.click(await screen.findByRole('button', { name: /^Undo the Nordea/ }));
    await user.click(screen.getByRole('button', { name: 'Remove this import' }));
    expect(await screen.findByText('No imports yet.')).toBeInTheDocument();
    expect(await store.countTransactions()).toBe(0);
  });

  it('restores a backup after confirming', async () => {
    const backup = serializeBackup(await store.exportBackup('2026-11-30T12:00:00.000Z'));
    await store.wipeAll();
    const user = renderPage();
    expect(await screen.findByText('No imports yet.')).toBeInTheDocument();
    await user.upload(screen.getByLabelText('Restore from a backup file'), new File([backup], 'b.json', { type: 'application/json' }));
    await user.click(await screen.findByRole('button', { name: 'Replace my data' }));
    expect(await screen.findByText(/28 transactions added/)).toBeInTheDocument();
    expect(await store.countTransactions()).toBe(28);
  });

  it('deletes everything and starts over on "Add statement"', async () => {
    const user = renderPage();
    await user.click(await screen.findByRole('button', { name: 'Delete all data…' }));
    await user.click(screen.getByRole('button', { name: 'Delete everything' }));
    await vi.waitFor(() => expect(window.location.hash).toBe('#/add'));
    expect(await store.countTransactions()).toBe(0);
  });
});
