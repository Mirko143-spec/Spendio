import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATEGORY_IDS as C } from '../core/categories.ts';
import { groupForReview, type ReviewDecision, type ReviewGroup } from '../core/review.ts';
import { freshStore } from './testing.ts';

const fixture = readFileSync(join(import.meta.dirname, '../../fixtures/nordea-sample.csv'), 'utf8');
let seq = 0;
const ctx = (now = '2026-12-29T10:00:00.000Z') => ({ now, newId: () => `id-${++seq}` });

const decide = (g: ReviewGroup, categoryId: string | null, remember = g.rememberByDefault): ReviewDecision => ({
  groupKey: g.key,
  transactionIds: g.transactionIds,
  merchantKey: g.merchantKey,
  kind: g.kind,
  categoryId,
  remember,
});

async function reviewStore() {
  const store = await freshStore();
  await store.importCsv(fixture, ctx());
  const groups = groupForReview(await store.listTransactions());
  const find = (kind: string, merchantKey: string) => groups.find((g) => g.kind === kind && g.merchantKey === merchantKey)!;
  return Object.assign(store, { groups, find });
}

describe('applyReviewDecisions', () => {
  it('stores chosen categories as the user’s own and clears them from review', async () => {
    await using store = await reviewStore();
    const { find } = store;
    const shop = find('swish_out', 'EXEMPELBUTIKEN AB');
    const result = await store.applyReviewDecisions([decide(shop, C.shopping)], ctx());
    expect(result).toEqual({ categorized: 1, rulesSaved: 1 });
    const t = await store.db.transactions.get(shop.transactionIds[0]!);
    expect(t).toMatchObject({ categoryId: C.shopping, categorySource: 'manual', suggested: false });
    expect(groupForReview(await store.listTransactions()).some((g) => g.key === shop.key)).toBe(false);
  });

  it('remembers merchants as rules, limited to the Swish direction for Swish', async () => {
    await using store = await reviewStore();
    const { find } = store;
    await store.applyReviewDecisions(
      [decide(find('card', 'EXEMPELSHOP'), C.shopping), decide(find('swish_in', 'DOE,JOHN'), C.income, true)],
      ctx(),
    );
    const rules = await store.listUserRules();
    expect(rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ op: 'equals', value: 'EXEMPELSHOP', categoryId: C.shopping }),
        expect.objectContaining({ op: 'equals', value: 'DOE,JOHN', kind: 'swish_in', categoryId: C.income }),
      ]),
    );
    expect(rules.find((r) => r.value === 'EXEMPELSHOP')).not.toHaveProperty('kind');
  });

  it('does not create a rule when "remember" is off', async () => {
    await using store = await reviewStore();
    const { find } = store;
    await store.applyReviewDecisions([decide(find('swish_out', 'ANNA TESTSSON'), C.restaurants, false)], ctx());
    expect(await store.listUserRules()).toEqual([]);
  });

  it('confirms an unchanged suggestion, and sends a cleared one back to Needs review', async () => {
    await using store = await reviewStore();
    const { find } = store;
    const toAnna = find('swish_out', 'ANNA TESTSSON');
    await store.applyReviewDecisions([decide(toAnna, C.swishPeople, false)], ctx());
    expect(await store.db.transactions.get(toAnna.transactionIds[0]!)).toMatchObject({
      categoryId: C.swishPeople,
      suggested: false,
    });

    await using other = await reviewStore();
    const find2 = other.find;
    const cleared = find2('swish_out', 'ANNA TESTSSON');
    await other.applyReviewDecisions([decide(cleared, null)], ctx());
    expect(await other.db.transactions.get(cleared.transactionIds[0]!)).toMatchObject({
      categoryId: null,
      categorySource: 'none',
      suggested: false,
    });
  });

  it('leaves untouched groups in review, including unconfirmed suggestions', async () => {
    await using store = await reviewStore();
    const { groups } = store;
    const unknown = groups.filter((g) => g.suggestedCategoryId === null);
    await store.applyReviewDecisions(unknown.map((g) => decide(g, null)), ctx());
    const after = groupForReview(await store.listTransactions());
    expect(after.map((g) => g.key).sort()).toEqual(groups.map((g) => g.key).sort());
  });

  it('applies remembered rules to the next import', async () => {
    await using store = await reviewStore();
    const { find } = store;
    const shop = find('card', 'EXEMPELSHOP');
    await store.applyReviewDecisions([decide(shop, C.shopping)], ctx());
    await store.deleteImportBatch((await store.listImportBatches())[0]!.id);
    await store.importCsv(fixture, ctx('2026-12-30T10:00:00.000Z'));
    const reimported = (await store.listTransactions()).find((t) => t.merchantKey === 'EXEMPELSHOP');
    expect(reimported).toMatchObject({ categoryId: C.shopping, categorySource: 'user_rule' });
  });

  it('saves nothing if any decision is invalid', async () => {
    await using store = await reviewStore();
    const { find } = store;
    const shop = find('card', 'EXEMPELSHOP');
    const bad = { ...decide(find('swish_out', 'EXEMPELBUTIKEN AB'), 'nope') };
    await expect(store.applyReviewDecisions([decide(shop, C.shopping), bad], ctx())).rejects.toThrow(/Unknown category/);
    expect(await store.db.transactions.get(shop.transactionIds[0]!)).toMatchObject({ categoryId: null });
    expect(await store.listUserRules()).toEqual([]);
  });
});
