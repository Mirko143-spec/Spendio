// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CATEGORY_IDS as C, DEFAULT_CATEGORIES } from '../core/categories.ts';
import { CategoryEditor } from './CategoryEditor.tsx';

function setup(overrides: Partial<Parameters<typeof CategoryEditor>[0]> = {}) {
  const props = {
    categories: DEFAULT_CATEGORIES,
    usage: new Map([[C.gaming, { transactions: 3, rules: 1, limits: 0 }]]),
    onUpdate: vi.fn().mockResolvedValue(undefined),
    onAdd: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  render(<CategoryEditor {...props} />);
  const row = (name: string) => screen.getByText(name, { selector: 'span.font-medium' }).closest('li')!;
  return { ...props, row, user: userEvent.setup() };
}

describe('CategoryEditor', () => {
  it('separates spending from income and transfers, with transaction counts', () => {
    const { row } = setup();
    const spending = within(screen.getByRole('region', { name: 'Spending categories' }));
    expect(spending.getByText('Gaming')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Not spending categories' })).getByText('Income')).toBeInTheDocument();
    expect(within(row('Gaming')).getByText('3 transactions')).toBeInTheDocument();
    expect(within(row('Income')).getByText('0 transactions, built in')).toBeInTheDocument();
  });

  it('renames a category', async () => {
    const { onUpdate, row, user } = setup();
    await user.click(within(row('Gaming')).getByRole('button', { name: 'Rename' }));
    const input = screen.getByLabelText('New name for Gaming');
    await user.clear(input);
    await user.type(input, 'Games');
    await user.click(screen.getByRole('button', { name: 'Save name' }));
    expect(onUpdate).toHaveBeenCalledWith(C.gaming, { name: 'Games' });
    expect(screen.queryByLabelText('New name for Gaming')).not.toBeInTheDocument();
  });

  it('shows why a rename failed and keeps the form open', async () => {
    const { row, user } = setup({ onUpdate: vi.fn().mockRejectedValue(new Error('A category named "Groceries" already exists')) });
    await user.click(within(row('Gaming')).getByRole('button', { name: 'Rename' }));
    await user.clear(screen.getByLabelText('New name for Gaming'));
    await user.type(screen.getByLabelText('New name for Gaming'), 'groceries');
    await user.click(screen.getByRole('button', { name: 'Save name' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('already exists');
    expect(screen.getByLabelText('New name for Gaming')).toBeInTheDocument();
  });

  it('changes a color', () => {
    const { onUpdate } = setup();
    fireEvent.change(screen.getByLabelText('Color for Gaming'), { target: { value: '#123456' } });
    expect(onUpdate).toHaveBeenCalledWith(C.gaming, { color: '#123456' });
  });

  it('adds a spending category and clears the form', async () => {
    const { onAdd, user } = setup();
    fireEvent.change(screen.getByLabelText('Color for the new category'), { target: { value: '#aa5500' } });
    await user.type(screen.getByLabelText('Name of the new category'), 'Pets');
    await user.click(screen.getByRole('button', { name: 'Add category' }));
    expect(onAdd).toHaveBeenCalledWith({ name: 'Pets', color: '#aa5500' });
    expect(screen.getByLabelText('Name of the new category')).toHaveValue('');
  });

  it('renders extra controls per row', () => {
    setup({ renderExtra: (c) => <span>extra for {c.id}</span> });
    expect(screen.getByText(`extra for ${C.gaming}`)).toBeInTheDocument();
  });
});
