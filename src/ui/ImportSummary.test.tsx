// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ImportResult } from '../core/import.ts';
import { ImportSummary } from './ImportSummary.tsx';

const result = (batch: Partial<ImportResult['batch']>, errors: ImportResult['errors'] = []) => ({
  format: { id: 'nordea', name: 'Nordea', country: 'SE' },
  batch: {
    id: 'b',
    accountId: 'account:nordea',
    label: 'Nordea · 2026-12-29',
    importedAt: '2026-12-29T10:00:00.000Z',
    rowCount: 56,
    newCount: 41,
    duplicateCount: 15,
    errorCount: 0,
    ...batch,
  },
  errors,
});

const value = (label: string) => screen.getByText(label).nextElementSibling?.textContent;

describe('ImportSummary', () => {
  it('shows what was imported and offers review', async () => {
    const onReview = vi.fn();
    const onDone = vi.fn();
    render(<ImportSummary result={result({})} reviewCount={9} onReview={onReview} onDone={onDone} />);
    expect(screen.getByRole('heading', { name: 'Imported 41 transactions' })).toBeInTheDocument();
    expect(screen.getByText('From your Nordea statement.')).toBeInTheDocument();
    expect(value('New')).toBe('41');
    expect(value('Already imported, skipped')).toBe('15');
    expect(screen.queryByText('Lines that couldn’t be read')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Review 9 transactions' }));
    expect(onReview).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Review later' }));
    expect(onDone).toHaveBeenCalled();
  });

  it('says when a file had nothing new', () => {
    render(<ImportSummary result={result({ newCount: 0, duplicateCount: 56 })} reviewCount={0} onReview={vi.fn()} onDone={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Nothing new in this file' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Review/ })).not.toBeInTheDocument();
  });

  it('lists lines that could not be read', () => {
    render(
      <ImportSummary
        result={result({ errorCount: 1, newCount: 40 }, [{ line: 30, message: 'Invalid amount: "abc"' }])}
        reviewCount={0}
        onReview={vi.fn()}
        onDone={vi.fn()}
      />,
    );
    expect(value('Lines that couldn’t be read')).toBe('1');
    expect(screen.getByText('Line 30: Invalid amount: "abc"')).toBeInTheDocument();
  });

  it('uses singular wording for one transaction', () => {
    render(<ImportSummary result={result({ newCount: 1 })} reviewCount={1} onReview={vi.fn()} onDone={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Imported 1 transaction' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review 1 transaction' })).toBeInTheDocument();
  });
});
