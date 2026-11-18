// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CATEGORY_IDS as C, DEFAULT_CATEGORIES } from '../core/categories.ts';
import { SWEDEN } from '../core/country/se/index.ts';
import type { Rule } from '../core/rules.ts';
import { RulesList } from './RulesList.tsx';

const rule = (overrides: Partial<Rule>): Rule => ({
  id: 'r',
  source: 'user',
  op: 'equals',
  value: 'X',
  categoryId: C.other,
  createdAt: '2026-11-01T00:00:00.000Z',
  ...overrides,
});

const USER_RULES = [
  rule({ id: 'old', value: 'TEBEX.ORG', categoryId: C.gaming, createdAt: '2026-11-01T00:00:00.000Z' }),
  rule({ id: 'new', value: 'ANNA TESTSSON', kind: 'swish_in', categoryId: C.restaurants, createdAt: '2026-11-10T00:00:00.000Z' }),
];

function setup(userRules: Rule[] = USER_RULES) {
  const onChangeCategory = vi.fn().mockResolvedValue(undefined);
  const onDelete = vi.fn().mockResolvedValue(undefined);
  render(
    <RulesList
      userRules={userRules}
      builtinRules={SWEDEN.builtinRules}
      countryName="Sweden"
      categories={DEFAULT_CATEGORIES}
      onChangeCategory={onChangeCategory}
      onDelete={onDelete}
    />,
  );
  return { onChangeCategory, onDelete, user: userEvent.setup() };
}

describe('RulesList', () => {
  it('lists your rules newest first, in plain language, with their category', () => {
    setup();
    const items = within(screen.getByRole('region', { name: 'Your rules' })).getAllByRole('listitem');
    expect(items.map((li) => li.querySelector('span')!.textContent)).toEqual([
      'Merchant is exactly ANNA TESTSSON, Swish received only',
      'Merchant is exactly TEBEX.ORG',
    ]);
    expect(screen.getByRole('combobox', { name: 'Category for rule: Merchant is exactly TEBEX.ORG' })).toHaveValue(C.gaming);
  });

  it('changes a rule’s category and deletes rules', async () => {
    const { onChangeCategory, onDelete, user } = setup();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Category for rule: Merchant is exactly TEBEX.ORG' }), C.entertainment);
    expect(onChangeCategory).toHaveBeenCalledWith(USER_RULES[0], C.entertainment);
    await user.click(screen.getByRole('button', { name: 'Delete rule: Merchant is exactly TEBEX.ORG' }));
    expect(onDelete).toHaveBeenCalledWith('old');
  });

  it('explains when there are no rules yet', () => {
    setup([]);
    expect(screen.getByText('No rules yet.')).toBeInTheDocument();
  });

  it('shows the built-in rules read-only, grouped by category, behind a disclosure', async () => {
    const { user } = setup();
    const summary = screen.getByText(`Built-in rules for Sweden (${SWEDEN.builtinRules.length})`);
    await user.click(summary);
    const groceries = screen.getByRole('heading', { name: 'Groceries' });
    expect(groceries.nextElementSibling!.textContent).toContain('ICA, MAXI ICA, COOP');
    expect(within(summary.closest('details')!).queryByRole('combobox')).not.toBeInTheDocument();
  });
});
