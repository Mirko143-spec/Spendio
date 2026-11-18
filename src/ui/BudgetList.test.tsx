// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Budget } from '../core/budgets.ts';
import { CATEGORY_IDS as C, DEFAULT_CATEGORIES } from '../core/categories.ts';
import { buildDashboard } from '../core/dashboard.ts';
import { importCsv } from '../core/import.ts';
import { BudgetList } from './BudgetList.tsx';

const fixture = readFileSync(join(import.meta.dirname, '../../fixtures/nordea-sample.csv'), 'utf8');
let seq = 0;
const { transactions } = importCsv(fixture, { existingFingerprints: new Set(), now: '2026-12-29T10:00:00.000Z', newId: () => `id-${++seq}` });
const plain = (s: string | null) => (s ?? '').replace(/[\u00A0\u202F]/g, ' ');

const BUDGETS: Budget[] = [
  { id: '1', categoryId: C.gaming, amount: 30000, effectiveFrom: '2026-10' },
  { id: '2', categoryId: C.transport, amount: 80000, effectiveFrom: '2026-10' },
];

function setup(budgets: Budget[] = BUDGETS, onSetLimit = vi.fn().mockResolvedValue(undefined)) {
  const model = buildDashboard(transactions, DEFAULT_CATEGORIES, budgets, '2026-11');
  render(<BudgetList model={model} categories={DEFAULT_CATEGORIES} onSetLimit={onSetLimit} />);
  const rows = within(screen.getByRole('list')).getAllByRole('listitem');
  const row = (name: string) => rows.find((r) => r.textContent!.startsWith(name))!;
  return { onSetLimit, rows, row, user: userEvent.setup() };
}

describe('BudgetList', () => {
  it('lists all spending, then limits Over → Close → On track, and nothing without a limit', () => {
    const { rows } = setup();
    expect(rows.map((r) => r.querySelector('.font-medium')!.textContent)).toEqual(['All spending', 'Gaming', 'Transport']);
    expect(screen.queryByText('No category limits yet. Choose a category below to set one.')).not.toBeInTheDocument();
  });

  it('spells out each budget status in text', () => {
    const { row } = setup();
    expect(plain(row('Gaming').textContent)).toContain('Over by 29 kr');
    expect(plain(row('Transport').textContent)).toContain('84 % used, 131 kr left');
    expect(within(row('Gaming')).getByText(/Over by/)).toHaveClass('text-danger');
  });

  it('explains how to start when there are no category limits', () => {
    setup([]);
    expect(screen.getByText('No category limits yet. Choose a category below to set one.')).toBeInTheDocument();
  });

  it('sets a limit for a category in kronor, accepting Swedish formatting', async () => {
    const { onSetLimit, user } = setup();
    await user.selectOptions(screen.getByLabelText('Set a limit for another category'), C.health);
    await user.type(screen.getByLabelText('Monthly limit in kronor'), '1 500,50');
    await user.click(screen.getByRole('button', { name: 'Save limit' }));
    expect(onSetLimit).toHaveBeenCalledWith(C.health, 150050);
  });

  it('only offers categories that do not have a limit yet', () => {
    setup();
    const options = within(screen.getByLabelText('Set a limit for another category')).getAllByRole('option');
    const values = options.map((o) => o.getAttribute('value'));
    expect(values).toContain(C.health);
    expect(values).not.toContain(C.gaming);
    expect(values).not.toContain(C.income);
  });

  it('sets the overall limit and explains invalid amounts instead of saving them', async () => {
    const { onSetLimit, row, user } = setup();
    await user.click(within(row('All spending')).getByRole('button', { name: 'Set limit' }));
    await user.type(screen.getByLabelText('Monthly limit in kronor'), 'lots');
    await user.click(screen.getByRole('button', { name: 'Save limit' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter an amount in kronor');
    expect(onSetLimit).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText('Monthly limit in kronor'));
    await user.type(screen.getByLabelText('Monthly limit in kronor'), '12000');
    await user.click(screen.getByRole('button', { name: 'Save limit' }));
    expect(onSetLimit).toHaveBeenCalledWith(null, 1200000);
  });

  it('changes and removes an existing limit', async () => {
    const { onSetLimit, row, user } = setup();
    await user.click(within(row('Gaming')).getByRole('button', { name: 'Change limit' }));
    expect(screen.getByLabelText('Monthly limit in kronor')).toHaveValue('300');
    await user.click(screen.getByRole('button', { name: 'Remove limit' }));
    expect(onSetLimit).toHaveBeenCalledWith(C.gaming, null);
  });
});

describe('BudgetList links', () => {
  it('links rows to the matching transactions in the shown period', () => {
    setup();
    expect(screen.getByRole('link', { name: 'All spending' })).toHaveAttribute('href', '#/transactions?period=2026-11');
    expect(screen.getByRole('link', { name: 'Gaming' })).toHaveAttribute('href', '#/transactions?category=gaming&period=2026-11');
  });
});
