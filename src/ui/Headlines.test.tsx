// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CATEGORIES } from '../core/categories.ts';
import { buildDashboard } from '../core/dashboard.ts';
import { importCsv } from '../core/import.ts';
import { Headlines } from './Headlines.tsx';

const fixture = readFileSync(join(import.meta.dirname, '../../fixtures/nordea-sample.csv'), 'utf8');
let seq = 0;
const { transactions } = importCsv(fixture, { existingFingerprints: new Set(), now: '2026-12-29T10:00:00.000Z', newId: () => `id-${++seq}` });
const plain = (s: string | null) => (s ?? '').replace(/[\u00A0\u202F]/g, ' ');
const figure = (label: string) => screen.getByText(label).parentElement!;
/** The amount as announced to screen readers, e.g. "1 859,06 kr". */
const amountIn = (label: string) => plain(figure(label).querySelector('[aria-label]')!.getAttribute('aria-label'));

describe('Headlines', () => {
  it('shows spent with the change, left over with the savings rate, and no limit yet', () => {
    // December 2026: 1 859,06 kr spent; November net 200 kr (after 1 625 kr back from people).
    render(<Headlines model={buildDashboard(transactions, DEFAULT_CATEGORIES, [], '2026-12')} />);
    expect(amountIn('Spent')).toBe('1 859,06 kr');
    expect(figure('Spent')).toHaveTextContent('830 % more than November');
    expect(figure('Budget left')).toHaveTextContent('No overall limit set');
    expect(amountIn('Left over')).toBe('11 732,94 kr');
    expect(figure('Left over')).toHaveTextContent('86 % of income');
  });

  it('shows what is left of the overall limit', () => {
    const budgets = [{ id: 'b', categoryId: null, amount: 500000, effectiveFrom: '2026-12' }];
    render(<Headlines model={buildDashboard(transactions, DEFAULT_CATEGORIES, budgets, '2026-12')} />);
    expect(amountIn('Budget left')).toBe('3 140,94 kr');
    expect(plain(figure('Budget left').textContent)).toContain('of a 5 000 kr limit');
  });

  it('switches to "Over budget by" in the warning color', () => {
    const budgets = [{ id: 'b', categoryId: null, amount: 100000, effectiveFrom: '2026-12' }];
    render(<Headlines model={buildDashboard(transactions, DEFAULT_CATEGORIES, budgets, '2026-12')} />);
    const over = figure('Over budget by');
    expect(amountIn('Over budget by')).toBe('859,06 kr');
    expect(over.querySelector('.text-danger')).not.toBeNull();
  });

  it('handles a period without income or a previous period', () => {
    render(<Headlines model={buildDashboard(transactions, DEFAULT_CATEGORIES, [], '2026-10')} />);
    expect(figure('Spent')).toHaveTextContent('Nothing spent in September');
    expect(figure('Left over')).toHaveTextContent('No income this period');
    expect(amountIn('Left over')).toBe('minus 562,40 kr');
  });
});
