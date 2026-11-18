// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DeleteAllData } from './DeleteAllData.tsx';

describe('DeleteAllData', () => {
  it('only deletes after an explicit confirmation that says it cannot be undone', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<DeleteAllData onDelete={onDelete} />);
    await user.click(screen.getByRole('button', { name: 'Delete all data…' }));
    expect(screen.getByRole('group', { name: 'Delete everything on this device?' })).toHaveTextContent('can’t be undone');
    expect(onDelete).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Delete everything' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('cancels', async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(<DeleteAllData onDelete={onDelete} />);
    await user.click(screen.getByRole('button', { name: 'Delete all data…' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Delete all data…' })).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
  });
});
