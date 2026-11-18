// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ImportBatch } from '../core/import.ts';
import { ImportsSection } from './ImportsSection.tsx';

const batch = (overrides: Partial<ImportBatch>): ImportBatch => ({
  id: 'b1',
  accountId: 'account:nordea',
  label: 'Nordea · 2026-11-18',
  importedAt: '2026-11-18T10:00:00.000Z',
  rowCount: 28,
  newCount: 28,
  duplicateCount: 0,
  errorCount: 0,
  ...overrides,
});
const ACCOUNTS = [{ id: 'account:nordea', bank: 'nordea', name: 'Nordea' }];

describe('ImportsSection', () => {
  it('lists imports by bank and date with what they added', () => {
    render(
      <ImportsSection
        batches={[batch({ id: 'b2', importedAt: '2026-12-29T10:00:00.000Z', newCount: 8, duplicateCount: 20 }), batch({})]}
        accounts={ACCOUNTS}
        onUndo={vi.fn()}
      />,
    );
    const items = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(items[0]).toContain('Nordea, 29 Dec8 transactions added, 20 already there');
    expect(items[1]).toContain('Nordea, 18 Nov28 transactions added');
  });

  it('undoes an import only after confirming', async () => {
    const onUndo = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ImportsSection batches={[batch({})]} accounts={ACCOUNTS} onUndo={onUndo} />);
    await user.click(screen.getByRole('button', { name: 'Undo the Nordea, 18 Nov import' }));
    expect(screen.getByRole('group', { name: 'Undo the Nordea, 18 Nov import?' })).toHaveTextContent(
      'Its 28 transactions are removed, including categories you chose for them. Your rules stay.',
    );
    expect(onUndo).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Remove this import' }));
    expect(onUndo).toHaveBeenCalledWith('b1');
  });

  it('cancels, and says when there are no imports', async () => {
    const onUndo = vi.fn();
    const user = userEvent.setup();
    const { unmount } = render(<ImportsSection batches={[batch({})]} accounts={ACCOUNTS} onUndo={onUndo} />);
    await user.click(screen.getByRole('button', { name: /^Undo/ }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
    expect(onUndo).not.toHaveBeenCalled();
    unmount();
    render(<ImportsSection batches={[]} accounts={ACCOUNTS} onUndo={onUndo} />);
    expect(screen.getByText('No imports yet.')).toBeInTheDocument();
  });
});

describe('ImportsSection sample data', () => {
  it('labels the sample import as sample data rather than as a bank', () => {
    render(<ImportsSection batches={[batch({ label: 'Sample data' })]} accounts={ACCOUNTS} onUndo={vi.fn()} />);
    expect(screen.getByRole('listitem')).toHaveTextContent('Sample data, 18 Nov');
  });
});
