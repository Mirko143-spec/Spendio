import { describe, expect, it } from 'vitest';
import { limitFor } from '../core/budgets.ts';
import { CATEGORY_IDS as C } from '../core/categories.ts';
import { freshStore } from './testing.ts';

let seq = 0;
const newId = () => `id-${++seq}`;

describe('user rules', () => {
  const ctx = (now = '2026-12-01T00:00:00.000Z') => ({ now, newId });

  it('saves a normalized rule', async () => {
    await using store = await freshStore();
    const rule = await store.saveUserRule({ op: 'equals', value: '  tebex.org ', categoryId: C.gaming }, ctx());
    expect(rule).toMatchObject({ source: 'user', op: 'equals', value: 'TEBEX.ORG', categoryId: C.gaming });
    expect(rule).not.toHaveProperty('kind');
    expect(await store.listUserRules()).toEqual([rule]);
  });

  it('updates instead of duplicating a rule with the same match', async () => {
    await using store = await freshStore();
    const first = await store.saveUserRule({ op: 'equals', value: 'TEBEX.ORG', categoryId: C.gaming }, ctx());
    const second = await store.saveUserRule(
      { op: 'equals', value: 'tebex.org', categoryId: C.entertainment },
      ctx('2026-12-02T00:00:00.000Z'),
    );
    expect(second.id).toBe(first.id);
    expect(await store.listUserRules()).toEqual([second]);
  });

  it('keeps rules with a different kind separate', async () => {
    await using store = await freshStore();
    await store.saveUserRule({ op: 'equals', value: 'ANNA TESTSSON', kind: 'swish_in', categoryId: C.restaurants }, ctx());
    await store.saveUserRule({ op: 'equals', value: 'ANNA TESTSSON', kind: 'swish_out', categoryId: C.housing }, ctx());
    expect(await store.listUserRules()).toHaveLength(2);
  });

  it('rejects empty values and unknown categories; deletes rules', async () => {
    await using store = await freshStore();
    await expect(store.saveUserRule({ op: 'equals', value: ' ', categoryId: C.gaming }, ctx())).rejects.toThrow(/required/);
    await expect(store.saveUserRule({ op: 'equals', value: 'X', categoryId: 'nope' }, ctx())).rejects.toThrow(/Unknown/);
    const rule = await store.saveUserRule({ op: 'equals', value: 'X', categoryId: C.gaming }, ctx());
    await store.deleteUserRule(rule.id);
    expect(await store.listUserRules()).toEqual([]);
  });
});

describe('budget limits', () => {
  it('sets limits from a period on without rewriting earlier periods', async () => {
    await using store = await freshStore();
    await store.setBudgetLimit(C.gaming, 100000, '2026-11', newId);
    await store.setBudgetLimit(C.gaming, 150000, '2027-01', newId);
    await store.setBudgetLimit(null, 1200000, '2026-11', newId);
    const budgets = await store.listBudgets();
    expect(limitFor(budgets, C.gaming, '2026-12')).toBe(100000);
    expect(limitFor(budgets, C.gaming, '2027-01')).toBe(150000);
    expect(limitFor(budgets, null, '2027-01')).toBe(1200000);
  });

  it('replaces a limit changed twice in the same period, and removes with null', async () => {
    await using store = await freshStore();
    await store.setBudgetLimit(C.gaming, 100000, '2026-12', newId);
    await store.setBudgetLimit(C.gaming, 80000, '2026-12', newId);
    expect(await store.listBudgets()).toHaveLength(1);
    await store.setBudgetLimit(C.gaming, null, '2027-02', newId);
    expect(limitFor(await store.listBudgets(), C.gaming, '2027-02')).toBeNull();
  });

  it('only allows limits on spending categories', async () => {
    await using store = await freshStore();
    await expect(store.setBudgetLimit(C.income, 1, '2026-12', newId)).rejects.toThrow(/not a spending category/);
    await expect(store.setBudgetLimit('nope', 1, '2026-12', newId)).rejects.toThrow(/Unknown category/);
    await expect(store.setBudgetLimit(C.gaming, -1, '2026-12', newId)).rejects.toThrow(RangeError);
  });
});

describe('period settings', () => {
  it('saves and validates the period start day', async () => {
    await using store = await freshStore();
    expect(await store.savePeriodSettings({ startDay: 1 })).toMatchObject({ startDay: 1, adjustToBankingDay: true });
    expect(await store.getSettings()).toMatchObject({ startDay: 1 });
    await expect(store.savePeriodSettings({ startDay: 31 })).rejects.toThrow(RangeError);
    expect(await store.getSettings()).toMatchObject({ startDay: 1 });
  });
});
