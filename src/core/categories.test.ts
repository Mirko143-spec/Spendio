import { describe, expect, it } from 'vitest';
import { CATEGORY_IDS, countsAsSpending, DEFAULT_CATEGORIES, isSavingsTransfer } from './categories.ts';

describe('DEFAULT_CATEGORIES', () => {
  it('has unique ids and names', () => {
    expect(new Set(DEFAULT_CATEGORIES.map((c) => c.id)).size).toBe(DEFAULT_CATEGORIES.length);
    expect(new Set(DEFAULT_CATEGORIES.map((c) => c.name)).size).toBe(DEFAULT_CATEGORIES.length);
  });

  it('has the 12 agreed spending categories, in order', () => {
    expect(DEFAULT_CATEGORIES.filter(countsAsSpending).map((c) => c.name)).toEqual([
      'Groceries',
      'Restaurants & Cafés',
      'Transport',
      'Shopping',
      'Subscriptions',
      'Gaming',
      'Entertainment',
      'Health & Fitness',
      'Housing & Bills',
      'Travel',
      'Swish to people',
      'Other',
    ]);
  });

  it('has exactly three system categories, none of which count as spending', () => {
    const system = DEFAULT_CATEGORIES.filter((c) => c.system);
    expect(system.map((c) => c.id)).toEqual([CATEGORY_IDS.income, CATEGORY_IDS.savings, CATEGORY_IDS.internal]);
    expect(system.some(countsAsSpending)).toBe(false);
  });

  it('uses valid hex colors', () => {
    for (const c of DEFAULT_CATEGORIES) expect(c.color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('defines every id in CATEGORY_IDS', () => {
    const ids = new Set(DEFAULT_CATEGORIES.map((c) => c.id));
    for (const id of Object.values(CATEGORY_IDS)) expect(ids.has(id)).toBe(true);
  });
});

describe('isSavingsTransfer', () => {
  it('is only true for Transfer: Savings', () => {
    expect(DEFAULT_CATEGORIES.filter(isSavingsTransfer).map((c) => c.id)).toEqual([CATEGORY_IDS.savings]);
  });
});
