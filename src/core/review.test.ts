import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATEGORY_IDS as C } from './categories.ts';
import { importCsv, type Transaction } from './import.ts';
import { groupForReview, needsReview } from './review.ts';

const fixture = readFileSync(join(import.meta.dirname, '../../fixtures/nordea-sample.csv'), 'utf8');
let seq = 0;
const { transactions } = importCsv(fixture, {
  existingFingerprints: new Set(),
  now: '2026-12-29T10:00:00.000Z',
  newId: () => `id-${++seq}`,
});

describe('groupForReview on the fixture', () => {
  const groups = groupForReview(transactions);

  it('groups everything that needs a decision, biggest amounts first', () => {
    expect(groups.map((g) => [g.kind, g.merchantDisplay, g.total])).toEqual([
      ['swish_in', 'DOE,JOHN', 150000],
      ['swish_out', 'EXEMPELBUTIKEN AB', -89900],
      ['swish_out', 'ANNA TESTSSON', -25000],
      ['swish_refund', 'STIFTELSEN EXEMPELHUSET', 16000],
      ['swish_in', 'ANNA TESTSSON', 12500],
      ['card', 'EXEMPELSHOP', -8000],
    ]);
  });

  it('keeps paying and being paid by the same person as separate decisions', () => {
    const anna = groups.filter((g) => g.merchantKey === 'ANNA TESTSSON');
    expect(anna.map((g) => g.kind).sort()).toEqual(['swish_in', 'swish_out']);
  });

  it('carries the suggestion and the remember default', () => {
    const toAnna = groups.find((g) => g.kind === 'swish_out' && g.merchantKey === 'ANNA TESTSSON')!;
    expect(toAnna).toMatchObject({ suggestedCategoryId: C.swishPeople, isPerson: true, rememberByDefault: false });
    const shop = groups.find((g) => g.merchantKey === 'EXEMPELBUTIKEN AB')!;
    expect(shop).toMatchObject({ suggestedCategoryId: null, isPerson: false, rememberByDefault: true });
  });

  it('leaves out transactions that are already categorized', () => {
    const reviewed = new Set(groups.flatMap((g) => g.transactionIds));
    expect(reviewed.size).toBe(transactions.filter(needsReview).length);
    expect(transactions.filter((t) => !reviewed.has(t.id)).every((t) => t.categoryId !== null && !t.suggested)).toBe(true);
  });
});

describe('groupForReview details', () => {
  const tx = (overrides: Partial<Transaction>): Transaction => ({
    id: `t${++seq}`,
    accountId: 'a',
    importBatchId: 'b',
    fingerprint: `f${seq}`,
    bookingDate: '2026-11-01',
    effectiveDate: '2026-11-01',
    amount: -1000,
    currency: 'SEK',
    description: 'x',
    kind: 'card',
    merchantKey: 'TEBEX.ORG',
    merchantDisplay: 'TEBEX.ORG',
    categoryId: null,
    categorySource: 'none',
    suggested: false,
    ...overrides,
  });

  it('sums amounts and tracks the date range of a merchant', () => {
    const [group] = groupForReview([
      tx({ effectiveDate: '2026-11-08', amount: -46460 }),
      tx({ effectiveDate: '2026-11-03', amount: -46054 }),
      tx({ effectiveDate: '2026-11-10', amount: -5797 }),
    ]);
    expect(group).toMatchObject({ total: -98311, firstDate: '2026-11-03', lastDate: '2026-11-10' });
    expect(group!.transactionIds).toHaveLength(3);
  });

  it('only suggests a category when every transaction in the group agrees', () => {
    const [mixed] = groupForReview([
      tx({ kind: 'swish_out', merchantKey: 'X', categoryId: C.swishPeople, suggested: true }),
      tx({ kind: 'swish_out', merchantKey: 'X' }),
    ]);
    expect(mixed!.suggestedCategoryId).toBeNull();
  });

  it('returns nothing when nothing needs review', () => {
    expect(groupForReview([tx({ categoryId: C.gaming, categorySource: 'builtin_rule' })])).toEqual([]);
  });
});
