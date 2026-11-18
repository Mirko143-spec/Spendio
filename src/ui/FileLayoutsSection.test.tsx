// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { CsvMapping } from '../core/csv/mapping.ts';
import { FileLayoutsSection } from './FileLayoutsSection.tsx';

const mapping: CsvMapping = {
  id: 'm1',
  headerSignature: 'date,text,amount',
  name: 'Testbank',
  delimiter: ',',
  dateFormat: 'DD/MM/YYYY',
  decimal: '.',
  columns: { date: 0, description: [1], amount: 2 },
  createdAt: '2026-11-18T12:00:00.000Z',
};

describe('FileLayoutsSection', () => {
  it('lists layouts and forgets one after confirming', async () => {
    const onForget = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<FileLayoutsSection mappings={[mapping]} onForget={onForget} />);
    expect(screen.getByRole('listitem')).toHaveTextContent('Testbankset up 18 Nov');
    await user.click(screen.getByRole('button', { name: 'Forget the Testbank layout' }));
    expect(screen.getByRole('group', { name: 'Forget the Testbank layout?' })).toHaveTextContent('Transactions you already imported stay.');
    expect(onForget).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Forget layout' }));
    expect(onForget).toHaveBeenCalledWith('m1');
  });

  it('explains where layouts come from when there are none', () => {
    render(<FileLayoutsSection mappings={[]} onForget={vi.fn()} />);
    expect(screen.getByText(/created when you add a file from another bank/)).toBeInTheDocument();
  });
});
