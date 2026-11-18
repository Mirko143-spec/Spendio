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

const budgets: Budget[] = [
  { id: '1', categoryId: C.gaming, amount: 30000, effectiveFrom: '2026-10' },
  { id: '2', categoryId: C.transport, amount: 80000, effectiveFrom: '2026-10' },
];

function setup(onSetLimit = vi.fn().mockResolvedValue(undefined)) {
  const model = buildDashboard(transactions, DEFAULT_CATEGORIES, budgets, '2026-11');
  render(<BudgetList model={model} categories={DEFAULT_CATEGORIES} onSetLimit={onSetLimit} />);
  const rows = within(screen.getByRole('list')).getAllByRole('listitem');
  const row = (name: string) => rows.find((r) => r.textContent!.startsWith(name))!;
  return { onSetLimit, rows, row, user: userEvent.setup() };
}

describe('BudgetList', () => {
  it('orders rows: all spending, over, close, other spending, money back', () => {
    const { rows } = setup();
    expect(rows.map((r) => r.querySelector(".font-medium")!.textContent)).toEqual([
      'All spending',
      'Gaming',
      'Transport',
      'Health & Fitness',
      'Restaurants & Cafés',
      'Subscriptions',
      'Swish from people',
    ]);
  });

  it('spells out each budget status in text', () => {
    const { row } = setup();
    expect(plain(row('Gaming').textContent)).toContain('Over by 29 kr');
    expect(plain(row('Transport').textContent)).toContain('84 % used, 131 kr left');
    expect(within(row('Gaming')).getByText(/Over by/)).toHaveClass('text-danger');
    expect(within(row('Health & Fitness')).getByRole('button', { name: 'Set limit' })).toBeInTheDocument();
  });

  it('shows money back from people as money back, not spending', () => {
    const { row } = setup();
    expect(plain(row('Swish from people').textContent)).toMatch(/\+1 625,00 ?kr ?back/);
  });

  it('sets a limit in kronor, accepting Swedish formatting', async () => {
    const { onSetLimit, row, user } = setup();
    await user.click(within(row('Health & Fitness')).getByRole('button', { name: 'Set limit' }));
    await user.type(screen.getByLabelText('Monthly limit in kronor'), '1 500,50');
    await user.click(screen.getByRole('button', { name: 'Save limit' }));
    expect(onSetLimit).toHaveBeenCalledWith(C.health, 150050);
  });

  it('explains invalid amounts instead of saving them', async () => {
    const { onSetLimit, row, user } = setup();
    await user.click(within(row('All spending')).getByRole('button', { name: 'Set limit' }));
    await user.type(screen.getByLabelText('Monthly limit in kronor'), 'lots');
    await user.click(screen.getByRole('button', { name: 'Save limit' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter an amount in kronor');
    expect(onSetLimit).not.toHaveBeenCalled();
  });

  it('changes and removes an existing limit', async () => {
    const { onSetLimit, row, user } = setup();
    await user.click(within(row('Gaming')).getByRole('button', { name: 'Change limit' }));
    const input = screen.getByLabelText('Monthly limit in kronor');
    expect(input).toHaveValue('300');
    await user.click(screen.getByRole('button', { name: 'Remove limit' }));
    expect(onSetLimit).toHaveBeenCalledWith(C.gaming, null);
  });

  it('offers limits for categories without spending this period', async () => {
    const { onSetLimit, user } = setup();
    await user.selectOptions(screen.getByLabelText('Set a limit for another category'), C.groceries);
    await user.type(screen.getByLabelText('Monthly limit in kronor'), '2000');
    await user.click(screen.getByRole('button', { name: 'Save limit' }));
    expect(onSetLimit).toHaveBeenCalledWith(C.groceries, 200000);
  });
});
