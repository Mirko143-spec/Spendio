// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CATEGORY_IDS as C, DEFAULT_CATEGORIES } from '../core/categories.ts';
import { buildHistory } from '../core/history.ts';
import { importCsv } from '../core/import.ts';
import { plain } from '../test-utils.ts';
import { HistoryTable } from './HistoryTable.tsx';

const fixture = readFileSync(join(import.meta.dirname, '../../fixtures/nordea-sample.csv'), 'utf8');
let seq = 0;
const { transactions } = importCsv(fixture, { existingFingerprints: new Set(), now: '2026-12-29T10:00:00.000Z', newId: () => `id-${++seq}` });
const budgets = [{ id: 'g', categoryId: C.groceries, amount: 50000, effectiveFrom: '2026-10' }];

function setup() {
  render(<HistoryTable model={buildHistory(transactions, DEFAULT_CATEGORIES, budgets, '2027-01', 4)} />);
  const row = (name: string) => screen.getByRole('rowheader', { name: new RegExp(`^${name}`) }).closest('tr')!;
  return { row };
}

describe('HistoryTable', () => {
  it('has a column per month, with the year where it starts', () => {
    setup();
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(['Category', 'Oct', 'Nov', 'Dec', 'Jan2027']);
    expect(screen.getByTitle('December 2026: 25 Nov – 22 Dec')).toBeInTheDocument();
  });

  it('spells out each month against its limit and summarizes the row', () => {
    const { row } = setup();
    const groceries = row('Groceries');
    expect(within(groceries).getByRole('rowheader')).toHaveTextContent('Over in 1 of 4 months');
    const cells = within(groceries).getAllByRole('cell').map((c) => plain(c.textContent));
    expect(cells).toEqual(['312 krof 500 kr', '–of 500 kr', '1 645 krover by 1 145 kr', '–of 500 kr']);
    expect(within(groceries).getAllByRole('cell')[2]).toHaveClass('bg-danger/10');
  });

  it('shows plain amounts where there is no limit', () => {
    const { row } = setup();
    expect(within(row('Transport')).getAllByRole('cell').map((c) => plain(c.textContent))).toEqual(['–', '669 kr', '–', '–']);
    expect(within(row('Transport')).getByRole('rowheader')).not.toHaveTextContent(/Over in|Within/);
  });

  it('links amounts to the matching transactions', () => {
    const { row } = setup();
    expect(within(row('Groceries')).getByRole('link', { name: (n) => plain(n) === '1 645 kr' })).toHaveAttribute(
      'href',
      '#/transactions?category=groceries&period=2026-12',
    );
    expect(within(row('All spending')).getAllByRole('link')[0]).toHaveAttribute('href', '#/transactions?period=2026-10');
  });
});

describe('HistoryTable on small screens', () => {
  it('tells phone users the table scrolls sideways (hidden from sm up)', () => {
    setup();
    expect(screen.getByText('Scroll sideways for more months.')).toHaveClass('sm:hidden');
  });
});
