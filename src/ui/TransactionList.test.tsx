// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CATEGORY_IDS as C, DEFAULT_CATEGORIES } from '../core/categories.ts';
import { importCsv, type Transaction } from '../core/import.ts';
import { filterTransactions, NO_FILTER } from '../core/transaction-filter.ts';
import { PAGE_SIZE, TransactionList } from './TransactionList.tsx';

const fixture = readFileSync(join(import.meta.dirname, '../../fixtures/nordea-sample.csv'), 'utf8');
let seq = 0;
const all = filterTransactions(
  importCsv(fixture, { existingFingerprints: new Set(), now: '2026-12-29T10:00:00.000Z', newId: () => `id-${++seq}` }).transactions,
  NO_FILTER,
);

function setup(transactions: readonly Transaction[] = all) {
  const onSetOne = vi.fn().mockResolvedValue(undefined);
  const onSetMerchant = vi.fn().mockResolvedValue(undefined);
  render(<TransactionList transactions={transactions} categories={DEFAULT_CATEGORIES} onSetOne={onSetOne} onSetMerchant={onSetMerchant} />);
  return { onSetOne, onSetMerchant, user: userEvent.setup() };
}

const roblox = () => all.find((t) => t.merchantKey === 'ROBLOX.COM')!;

describe('TransactionList', () => {
  it('shows each transaction with a readable title, date, kind, amount and category', () => {
    setup();
    expect(screen.getByText('28 transactions')).toBeInTheDocument();
    const row = screen.getByRole('combobox', { name: 'Category for Swish from John Doe' }).closest('li')!;
    expect(within(row).getByText('12 Nov, Swish received, suggested category')).toBeInTheDocument();
    expect(within(row).getByLabelText('1 500,00 kr')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Category for Swish from John Doe' })).toHaveValue(C.swishFromPeople);
  });

  it('asks how far a change should go, and changes only this one', async () => {
    const { onSetOne, onSetMerchant, user } = setup();
    const select = screen.getAllByRole('combobox', { name: 'Category for ROBLOX.COM' })[0]!;
    await user.selectOptions(select, C.entertainment);
    const ask = screen.getByRole('group', { name: 'Change the category for…' });
    await user.click(within(ask).getByRole('button', { name: 'Only this one' }));
    expect(onSetOne).toHaveBeenCalledWith(expect.any(String), C.entertainment);
    expect(onSetMerchant).not.toHaveBeenCalled();
    expect(screen.queryByRole('group', { name: 'Change the category for…' })).not.toBeInTheDocument();
  });

  it('changes all from a merchant, including earlier ones unless unticked', async () => {
    const { onSetMerchant, user } = setup([roblox()]);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Category for ROBLOX.COM' }), C.entertainment);
    await user.click(screen.getByRole('button', { name: 'All from ROBLOX.COM' }));
    expect(onSetMerchant).toHaveBeenLastCalledWith(roblox().id, C.entertainment, true);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Category for ROBLOX.COM' }), C.shopping);
    await user.click(screen.getByRole('checkbox', { name: /also change earlier ones/ }));
    await user.click(screen.getByRole('button', { name: 'All from ROBLOX.COM' }));
    expect(onSetMerchant).toHaveBeenLastCalledWith(roblox().id, C.shopping, false);
  });

  it('names people by their tidied name in "All from…"', async () => {
    const { user } = setup();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Category for Swish from John Doe' }), C.income);
    expect(screen.getByRole('button', { name: 'All from John Doe' })).toBeInTheDocument();
  });

  it('sends a transaction back to Needs review straight away, for that one only', async () => {
    const { onSetOne, user } = setup([roblox()]);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Category for ROBLOX.COM' }), '');
    expect(onSetOne).toHaveBeenCalledWith(roblox().id, null);
    expect(screen.queryByRole('group', { name: 'Change the category for…' })).not.toBeInTheDocument();
  });

  it('cancels a pending change', async () => {
    const { onSetOne, onSetMerchant, user } = setup([roblox()]);
    const select = screen.getByRole('combobox', { name: 'Category for ROBLOX.COM' });
    await user.selectOptions(select, C.entertainment);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(select).toHaveValue(C.gaming);
    expect(onSetOne).not.toHaveBeenCalled();
    expect(onSetMerchant).not.toHaveBeenCalled();
  });

  it('shows long lists a page at a time', async () => {
    const many = Array.from({ length: PAGE_SIZE + 30 }, (_, i) => ({ ...roblox(), id: `t${i}` }));
    const { user } = setup(many);
    expect(screen.getAllByRole('listitem')).toHaveLength(PAGE_SIZE);
    await user.click(screen.getByRole('button', { name: 'Show 30 more' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(PAGE_SIZE + 30);
  });

  it('says so when nothing matches', () => {
    setup([]);
    expect(screen.getByText('No transactions match these filters.')).toBeInTheDocument();
  });
});
