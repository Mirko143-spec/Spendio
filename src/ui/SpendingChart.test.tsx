// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CATEGORIES } from '../core/categories.ts';
import { buildDashboard } from '../core/dashboard.ts';
import { importCsv } from '../core/import.ts';
import { SpendingChart } from './SpendingChart.tsx';

const fixture = readFileSync(join(import.meta.dirname, '../../fixtures/nordea-sample.csv'), 'utf8');
let seq = 0;
const { transactions } = importCsv(fixture, { existingFingerprints: new Set(), now: '2026-12-29T10:00:00.000Z', newId: () => `id-${++seq}` });
const plain = (s: string | null) => (s ?? '').replace(/[\u00A0\u202F]/g, ' ');
const model = (label: string) => buildDashboard(transactions, DEFAULT_CATEGORIES, [], label);

describe('SpendingChart', () => {
  it('ranks categories largest first, each announced with amount and share', () => {
    render(<SpendingChart model={model('2026-11')} />);
    const bars = within(screen.getByRole('list', { name: 'Spending by category, largest first' })).getAllByRole('listitem');
    expect(bars.map((b) => plain(b.getAttribute('aria-label')))).toEqual([
      'Transport: 669 kr, 37 % of spending',
      'Health & Fitness: 546 kr, 30 % of spending',
      'Gaming: 329 kr, 18 % of spending',
      'Restaurants & Cafés: 152 kr, 8 % of spending',
      'Subscriptions: 129 kr, 7 % of spending',
    ]);
  });

  it('draws bars proportional to the largest', () => {
    render(<SpendingChart model={model('2026-11')} />);
    const ratios = screen.getAllByRole('listitem').map((b) => Number(b.querySelector('[data-ratio]')!.getAttribute('data-ratio')));
    expect(ratios[0]).toBe(1);
    expect(ratios[2]).toBeCloseTo(32900 / 66900);
    expect([...ratios].sort((a, b) => b - a)).toEqual(ratios);
  });

  it('shows the share on hover and keyboard focus', () => {
    render(<SpendingChart model={model('2026-11')} />);
    const [first, second] = screen.getAllByRole('listitem');
    fireEvent.pointerEnter(first!);
    expect(screen.getByRole('tooltip')).toHaveTextContent('37 % of spending');
    fireEvent.pointerLeave(first!);
    fireEvent.focus(second!);
    expect(screen.getByRole('tooltip')).toHaveTextContent('30 % of spending');
    fireEvent.blur(second!);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('notes money back that the bars leave out', () => {
    render(<SpendingChart model={model('2026-11')} />);
    expect(plain(screen.getByText(/^Not shown:/).textContent)).toBe(
      'Not shown: 1 625 kr money back from people, which lowers total spending.',
    );
  });

  it('says so when nothing was spent', () => {
    render(<SpendingChart model={model('2027-06')} />);
    expect(screen.getByText('Nothing spent in this period.')).toBeInTheDocument();
  });
});
