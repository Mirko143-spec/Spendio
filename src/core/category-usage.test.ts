import { describe, expect, it } from 'vitest';
import { usageByCategory } from './category-usage.ts';

describe('usageByCategory', () => {
  it('counts transactions, rules and limit records per category', () => {
    const usage = usageByCategory(
      [{ categoryId: 'gaming' }, { categoryId: 'gaming' }, { categoryId: null }, { categoryId: 'shopping' }],
      [{ categoryId: 'gaming' }],
      [{ categoryId: 'gaming' }, { categoryId: 'gaming' }, { categoryId: null }],
    );
    expect(usage.get('gaming')).toEqual({ transactions: 2, rules: 1, limits: 2 });
    expect(usage.get('shopping')).toEqual({ transactions: 1, rules: 0, limits: 0 });
    expect(usage.has('groceries')).toBe(false);
  });
});
