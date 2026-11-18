// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CATEGORY_IDS as C, DEFAULT_CATEGORIES } from '../core/categories.ts';
import { CategoryLimit } from './CategoryLimit.tsx';
import { plain } from '../test-utils.ts';

const category = (id: string) => DEFAULT_CATEGORIES.find((c) => c.id === id)!;

describe('CategoryLimit', () => {
  it('sets a limit from the current period on', async () => {
    const onSetLimit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<CategoryLimit category={category(C.gaming)} limit={null} period="2026-11" onSetLimit={onSetLimit} />);
    await user.click(screen.getByRole('button', { name: 'Set a monthly limit' }));
    expect(screen.getByText('Monthly limit for Gaming, from November 2026 on')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Monthly limit in kronor'), '500');
    await user.click(screen.getByRole('button', { name: 'Save limit' }));
    expect(onSetLimit).toHaveBeenCalledWith(50000);
  });

  it('shows and changes an existing limit', async () => {
    const onSetLimit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<CategoryLimit category={category(C.gaming)} limit={50000} period="2026-11" onSetLimit={onSetLimit} />);
    expect(plain(screen.getByText(/^Limit/).textContent)).toBe('Limit 500 kr a month');
    await user.click(screen.getByRole('button', { name: 'Change limit' }));
    await user.click(screen.getByRole('button', { name: 'Remove limit' }));
    expect(onSetLimit).toHaveBeenCalledWith(null);
  });

  it('is not offered for income or transfers', () => {
    const { container } = render(
      <CategoryLimit category={category(C.income)} limit={null} period="2026-11" onSetLimit={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
