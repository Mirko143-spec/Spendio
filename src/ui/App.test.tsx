// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
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
afterEach(async () => {
  for (const name of names.splice(0)) await Dexie.delete(name);
});

const upload = async (text: string) =>
  userEvent.upload(await screen.findByLabelText('Choose a CSV file'), new File([text], 'statement.csv', { type: 'text/csv' }));

describe('App import flow', () => {
  it('imports, summarizes, reviews and saves to storage', async () => {
    const name = dbName();
    const user = userEvent.setup();
    render(<App dbName={name} />);

    await upload(fixture);
    expect(await screen.findByRole('heading', { name: 'Imported 28 transactions' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Review 6 transactions' }));
    const shop = await screen.findByRole('combobox', { name: 'EXEMPELSHOP' });
    await user.selectOptions(shop, C.shopping);
    await user.click(screen.getByRole('button', { name: /^Save/ }));
    expect(await screen.findByRole('heading', { name: 'Saved on this device' })).toBeInTheDocument();

    const store = await openStore(name);
    const saved = (await store.listTransactions()).find((t) => t.merchantKey === 'EXEMPELSHOP');
    expect(saved).toMatchObject({ categoryId: C.shopping, categorySource: 'manual' });
    expect(await store.listUserRules()).toEqual([expect.objectContaining({ value: 'EXEMPELSHOP', categoryId: C.shopping })]);
    store.close();
  });

  it('reports nothing new when the same file is added again', async () => {
    const user = userEvent.setup();
    render(<App dbName={dbName()} />);
    await upload(fixture);
    await user.click(await screen.findByRole('button', { name: 'Review later' }));
    await user.click(await screen.findByRole('button', { name: 'Add another statement' }));
    await upload(fixture);
    const heading = await screen.findByRole('heading', { name: 'Nothing new in this file' });
    expect(within(heading.closest('section')!).getByText('Already imported, skipped').nextElementSibling).toHaveTextContent('28');
  });

  it('shows a clear error for files no bank format recognizes', async () => {
    render(<App dbName={dbName()} />);
    await upload('Date,Amount\n2026-11-01,-1.00');
    expect(await screen.findByRole('alert')).toHaveTextContent('Spendio can’t read this file yet');
  });
});
