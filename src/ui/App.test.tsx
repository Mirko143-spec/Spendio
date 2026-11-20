// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CATEGORY_IDS as C } from '../core/categories.ts';
import { openStore } from '../storage/store.ts';
import { App } from './App.tsx';

const fixture = readFileSync(join(import.meta.dirname, '../../fixtures/nordea-sample.csv'), 'utf8');
const names: string[] = [];
const dbName = () => {
  const name = `spendio-app-test-${crypto.randomUUID()}`;
  names.push(name);
  return name;
};
beforeEach(() => {
  window.location.hash = '';
});
afterEach(async () => {
  for (const name of names.splice(0)) await Dexie.delete(name);
});

const upload = async (text: string) =>
  userEvent.upload(await screen.findByLabelText('Choose a CSV or PDF file'), new File([text], 'statement.csv', { type: 'text/csv' }));

describe('App', () => {
  it('shows a first-time visitor the landing page, without the app menu', async () => {
    render(<App dbName={dbName()} />);
    expect(await screen.findByRole('heading', { level: 1, name: 'See where your money goes.' })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/welcome');
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  });

  it('links back to the landing page, which then leads to your overview', async () => {
    const name = dbName();
    const user = userEvent.setup();
    window.location.hash = '#/add';
    render(<App dbName={name} />);
    await upload(fixture);
    await user.click(await screen.findByRole('button', { name: 'Review later' }));
    await user.click(await screen.findByRole('link', { name: 'About Spendio' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'See where your money goes.' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sample data/ })).not.toBeInTheDocument();
    await user.click(screen.getAllByRole('link', { name: 'Open your overview' })[0]!);
    expect(await screen.findByRole('heading', { name: 'Overview' })).toBeInTheDocument();
  });

  it('imports, summarizes, reviews, saves, and lands on the overview', async () => {
    const name = dbName();
    const user = userEvent.setup();
    window.location.hash = '#/add';
    render(<App dbName={name} />);

    await upload(fixture);
    expect(await screen.findByRole('heading', { name: 'Imported 28 transactions' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Review 6 transactions' }));
    await user.selectOptions(await screen.findByRole('combobox', { name: 'EXEMPELSHOP' }), C.shopping);
    await user.click(screen.getByRole('button', { name: /^Save/ }));
    expect(await screen.findByRole('heading', { name: 'Overview' })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/');

    const store = await openStore(name);
    expect((await store.listTransactions()).find((t) => t.merchantKey === 'EXEMPELSHOP')).toMatchObject({
      categoryId: C.shopping,
      categorySource: 'manual',
    });
    store.close();
  });

  it('opens on the overview once there is data, and reports nothing new on re-import', async () => {
    const name = dbName();
    const user = userEvent.setup();
    window.location.hash = '#/add';
    const { unmount } = render(<App dbName={name} />);
    await upload(fixture);
    await user.click(await screen.findByRole('button', { name: 'Review later' }));
    unmount();

    window.location.hash = '';
    render(<App dbName={name} />);
    expect(await screen.findByRole('heading', { name: 'Overview' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Add statement' }));
    await upload(fixture);
    const heading = await screen.findByRole('heading', { name: 'Nothing new in this file' });
    expect(within(heading.closest('section')!).getByText('Already imported, skipped').nextElementSibling).toHaveTextContent('28');
  });

  it('shows a clear error for files that are not a table at all', async () => {
    window.location.hash = '#/add';
    render(<App dbName={dbName()} />);
    await upload('This is not a statement');
    expect(await screen.findByRole('alert')).toHaveTextContent('This doesn’t look like a bank statement');
  });

  it('offers sample data on the landing page, and lands on the overview with it', async () => {
    const name = dbName();
    const user = userEvent.setup();
    render(<App dbName={name} />);
    await user.click((await screen.findAllByRole('button', { name: 'Try it with sample data' }))[0]!);
    expect(await screen.findByRole('heading', { name: 'Budgets' })).toBeInTheDocument();
    const store = await openStore(name);
    expect((await store.listImportBatches()).map((b) => b.label)).toEqual(['Sample data']);
    store.close();

    await user.click(screen.getByRole('link', { name: 'Add statement' }));
    await screen.findByLabelText('Choose a CSV or PDF file');
    expect(screen.queryByRole('button', { name: /sample data/ })).not.toBeInTheDocument();
  });

  it('sets up an unknown bank’s layout once, then imports that layout directly', async () => {
    const generic = readFileSync(join(import.meta.dirname, '../../fixtures/generic-sample.csv'), 'utf8');
    const user = userEvent.setup();
    window.location.hash = '#/add';
    render(<App dbName={dbName()} />);

    await upload(generic);
    expect(await screen.findByRole('heading', { name: 'Set up this file’s layout' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Which bank is this?'), 'Testbank');
    await user.click(screen.getByRole('button', { name: 'Save and import' }));
    expect(await screen.findByRole('heading', { name: 'Imported 9 transactions' })).toBeInTheDocument();
    expect(screen.getByText('From your Testbank statement.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Review later|Done/ }));
    await user.click(await screen.findByRole('link', { name: 'Add statement' }));
    await upload(generic);
    expect(await screen.findByRole('heading', { name: 'Nothing new in this file' })).toBeInTheDocument();
  });
});

describe('App without crypto.randomUUID (plain-HTTP pages, older Safari)', () => {
  it('still loads the sample data', async () => {
    const name = dbName(); // the test helper itself uses crypto.randomUUID
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });
    try {
      const user = userEvent.setup();
      render(<App dbName={name} />);
      await user.click((await screen.findAllByRole('button', { name: 'Try it with sample data' }))[0]!);
      expect(await screen.findByRole('heading', { name: 'Budgets' })).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
