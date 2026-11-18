// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CATEGORY_IDS as C, DEFAULT_CATEGORIES } from '../core/categories.ts';
import { NO_FILTER, type TransactionFilter } from '../core/transaction-filter.ts';
import { TransactionFilters } from './TransactionFilters.tsx';

function Harness({ onChange }: { onChange: (f: TransactionFilter) => void }) {
  const [filter, setFilter] = useState(NO_FILTER);
  return (
    <TransactionFilters
      filter={filter}
      periods={['2026-12', '2026-11']}
      categories={DEFAULT_CATEGORIES}
      onChange={(f) => {
        setFilter(f);
        onChange(f);
      }}
    />
  );
}

describe('TransactionFilters', () => {
  it('offers periods with data, categories incl. Needs review, and plain-language types', () => {
    render(<Harness onChange={vi.fn()} />);
    expect(within(screen.getByLabelText('Period')).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'All periods',
      'December 2026',
      'November 2026',
    ]);
    expect(within(screen.getByLabelText('Category')).getByRole('option', { name: 'Needs review' })).toBeInTheDocument();
    expect(within(screen.getByLabelText('Type')).getByRole('option', { name: 'Swish payments received' })).toHaveValue('swish_in');
    expect(screen.getByRole('search')).toBeInTheDocument();
  });

  it('reports every change as a whole filter', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);
    await user.selectOptions(screen.getByLabelText('Period'), '2026-11');
    await user.selectOptions(screen.getByLabelText('Category'), C.gaming);
    await user.selectOptions(screen.getByLabelText('Type'), 'card');
    await user.type(screen.getByLabelText('Search'), 'rob');
    expect(onChange).toHaveBeenLastCalledWith({ period: '2026-11', category: C.gaming, kind: 'card', query: 'rob' });
  });

  it('clears all filters at once, and only offers that when something is filtered', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Category'), 'needs-review');
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(onChange).toHaveBeenLastCalledWith(NO_FILTER);
  });
});
