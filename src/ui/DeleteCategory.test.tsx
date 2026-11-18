// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CATEGORY_IDS as C, DEFAULT_CATEGORIES } from '../core/categories.ts';
import type { CategoryUsage } from '../core/category-usage.ts';
import { DeleteCategory } from './DeleteCategory.tsx';

const category = (id: string) => DEFAULT_CATEGORIES.find((c) => c.id === id)!;

function setup(id: string, usage?: CategoryUsage) {
  const onDelete = vi.fn().mockResolvedValue(undefined);
  render(<DeleteCategory category={category(id)} categories={DEFAULT_CATEGORIES} usage={usage} onDelete={onDelete} />);
  return { onDelete, user: userEvent.setup() };
}

describe('DeleteCategory', () => {
  it('is not offered for built-in categories', () => {
    setup(C.income);
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('says what moves where, defaulting to Other', async () => {
    const { onDelete, user } = setup(C.gaming, { transactions: 3, rules: 1, limits: 2 });
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('group', { name: 'Delete Gaming?' })).toBeInTheDocument();
    const target = screen.getByLabelText('Move its 3 transactions and 1 rule to');
    expect(target).toHaveValue(C.other);
    expect(screen.getByText('Its monthly limit will be removed.')).toBeInTheDocument();

    await user.selectOptions(target, C.entertainment);
    await user.click(screen.getByRole('button', { name: 'Delete Gaming' }));
    expect(onDelete).toHaveBeenCalledWith(C.gaming, C.entertainment);
  });

  it('does not offer the category itself as a target', async () => {
    const { user } = setup(C.gaming, { transactions: 1, rules: 0, limits: 0 });
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const values = [...(screen.getByLabelText('Move its 1 transaction to') as HTMLSelectElement).options].map((o) => o.value);
    expect(values).not.toContain(C.gaming);
  });

  it('keeps it simple when nothing uses the category', async () => {
    const { onDelete, user } = setup(C.travel);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByText('Nothing is in this category yet.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete Travel' }));
    expect(onDelete).toHaveBeenCalledWith(C.travel, C.other);
  });

  it('cancels', async () => {
    const { onDelete, user } = setup(C.gaming, { transactions: 3, rules: 0, limits: 0 });
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('group', { name: 'Delete Gaming?' })).not.toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
  });
});
