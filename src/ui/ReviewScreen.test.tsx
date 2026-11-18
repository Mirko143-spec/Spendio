// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CATEGORY_IDS as C, DEFAULT_CATEGORIES } from '../core/categories.ts';
import { importCsv } from '../core/import.ts';
import { groupForReview } from '../core/review.ts';
import { ReviewScreen } from './ReviewScreen.tsx';

const fixture = readFileSync(join(import.meta.dirname, '../../fixtures/nordea-sample.csv'), 'utf8');
let seq = 0;
const groups = groupForReview(
  importCsv(fixture, { existingFingerprints: new Set(), now: '2026-12-29T10:00:00.000Z', newId: () => `id-${++seq}` })
    .transactions,
);

function setup() {
  const onSave = vi.fn();
  const onSkip = vi.fn();
  render(<ReviewScreen groups={groups} categories={DEFAULT_CATEGORIES} onSave={onSave} onSkip={onSkip} />);
  const rows = screen.getAllByRole('listitem');
  return { onSave, onSkip, rows, user: userEvent.setup() };
}

describe('ReviewScreen', () => {
  it('lists one row per merchant, biggest amounts first, with readable titles', () => {
    const { rows } = setup();
    expect(screen.getByRole('heading', { name: 'Review 6 transactions' })).toBeInTheDocument();
    expect(rows.map((r) => r.querySelector('p')!.textContent)).toEqual([
      'Swish from DOE,JOHN',
      'Swish to EXEMPELBUTIKEN AB',
      'Swish to ANNA TESTSSON',
      'Swish refund from STIFTELSEN EXEMPELHUSET',
      'Swish from ANNA TESTSSON',
      'EXEMPELSHOP',
    ]);
    expect(within(rows[0]!).getByText('1 payment, 12 Nov')).toBeInTheDocument();
    expect(within(rows[0]!).getByLabelText('1 500,00 kr')).toBeInTheDocument();
    expect(within(rows[1]!).getByLabelText('minus 899,00 kr')).toBeInTheDocument();
  });

  it('labels each category picker with its merchant', () => {
    setup();
    expect(screen.getByRole('combobox', { name: 'Swish to EXEMPELBUTIKEN AB' })).toHaveValue('');
  });

  it('pre-fills suggestions and leaves "Remember" off for people', () => {
    setup();
    expect(screen.getByRole('combobox', { name: 'Swish to ANNA TESTSSON' })).toHaveValue(C.swishPeople);
    const [toPerson, toShop] = [
      screen.getByRole('combobox', { name: 'Swish to ANNA TESTSSON' }).closest('li')!,
      screen.getByRole('combobox', { name: 'Swish to EXEMPELBUTIKEN AB' }).closest('li')!,
    ];
    expect(within(toPerson).getByRole('checkbox', { name: 'Remember for future imports' })).not.toBeChecked();
    expect(within(toShop).getByRole('checkbox', { name: 'Remember for future imports' })).toBeChecked();
  });

  it('saves every group with its choice', async () => {
    const { onSave, user } = setup();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Swish to EXEMPELBUTIKEN AB' }), C.shopping);
    await user.click(screen.getByRole('button', { name: 'Save 2 of 6' }));

    const decisions = onSave.mock.calls[0]![0];
    expect(decisions).toHaveLength(6);
    expect(decisions.find((d: { merchantKey: string }) => d.merchantKey === 'EXEMPELBUTIKEN AB')).toMatchObject({
      kind: 'swish_out',
      categoryId: C.shopping,
      remember: true,
    });
    expect(decisions.filter((d: { categoryId: string | null }) => d.categoryId === null)).toHaveLength(4);
  });

  it('can turn "Remember" off and skip', async () => {
    const { onSave, onSkip, user } = setup();
    const shopRow = screen.getByRole('combobox', { name: 'EXEMPELSHOP' }).closest('li')!;
    await user.selectOptions(within(shopRow).getByRole('combobox'), C.shopping);
    await user.click(within(shopRow).getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /^Save/ }));
    expect(onSave.mock.calls[0]![0].find((d: { merchantKey: string }) => d.merchantKey === 'EXEMPELSHOP').remember).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Skip for now' }));
    expect(onSkip).toHaveBeenCalled();
  });

  it('disables saving until a category is chosen', () => {
    const onlyUnknown = groups.filter((g) => g.suggestedCategoryId === null);
    render(<ReviewScreen groups={onlyUnknown} categories={DEFAULT_CATEGORIES} onSave={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Save choices' })).toBeDisabled();
  });

  it('says so when nothing needs review', () => {
    render(<ReviewScreen groups={[]} categories={DEFAULT_CATEGORIES} onSave={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Everything is categorized' })).toBeInTheDocument();
  });
});
