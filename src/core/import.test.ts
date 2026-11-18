import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATEGORY_IDS as C, DEFAULT_CATEGORIES } from './categories.ts';
import { NORDEA } from './formats/nordea/index.ts';
import type { BankFormat } from './formats/types.ts';
import { importCsv, UnsupportedFormatError, type ImportOptions } from './import.ts';
import type { Rule } from './rules.ts';
import { summarizePeriod } from './summary.ts';

const fixture = readFileSync(join(import.meta.dirname, '../../fixtures/nordea-sample.csv'), 'utf8');

function options(overrides: Partial<ImportOptions> = {}): ImportOptions {
  let seq = 0;
  return {
    existingFingerprints: new Set(),
    now: '2026-12-29T10:00:00.000Z',
    newId: () => `id-${++seq}`,
    ...overrides,
  };
}

describe('importCsv', () => {
  const result = importCsv(fixture, options());

  it('reports which bank format recognized the file', () => {
    expect(result.format).toEqual({ id: 'nordea', name: 'Nordea', country: 'SE' });
    expect(result.account).toEqual({ id: 'account:nordea', bank: 'nordea', name: 'Nordea' });
  });

  it('produces a batch summary', () => {
    expect(result.batch).toEqual({
      id: 'id-1',
      accountId: 'account:nordea',
      label: 'Nordea · 2026-12-29',
      importedAt: '2026-12-29T10:00:00.000Z',
      rowCount: 28,
      newCount: 28,
      duplicateCount: 0,
      errorCount: 0,
    });
    expect(result.errors).toEqual([]);
  });

  it('builds complete transactions', () => {
    const parkster = result.transactions.find((t) => t.merchantKey === 'PARKSTER SWE');
    expect(parkster).toEqual({
      id: expect.any(String),
      accountId: 'account:nordea',
      importBatchId: 'id-1',
      fingerprint: expect.any(String),
      bookingDate: '2026-11-25',
      purchaseDate: '2026-11-24',
      effectiveDate: '2026-11-24',
      amount: -2400,
      balance: expect.any(Number),
      currency: 'SEK',
      description: 'Kortköp 261124 PARKSTER SWE',
      kind: 'card',
      merchantKey: 'PARKSTER SWE',
      merchantDisplay: 'PARKSTER SWE',
      categoryId: C.transport,
      categorySource: 'builtin_rule',
      suggested: false,
    });
  });

  it('gives every transaction a unique id', () => {
    expect(new Set(result.transactions.map((t) => t.id)).size).toBe(28);
  });

  it('marks Swish people and the suggested category', () => {
    const swishOut = result.transactions.find((t) => t.kind === 'swish_out' && t.counterpartyIsPerson);
    expect(swishOut).toMatchObject({ categoryId: C.swishPeople, suggested: true, categorySource: 'kind_default' });
  });

  it('never carries the ID-column placeholder or line numbers', () => {
    const json = JSON.stringify(result);
    expect(json).not.toContain('000000-0000');
    expect(result.transactions[0]).not.toHaveProperty('line');
  });

  it('imports nothing on re-upload', () => {
    const again = importCsv(
      fixture,
      options({ existingFingerprints: new Set(result.transactions.map((t) => t.fingerprint)) }),
    );
    expect(again.transactions).toEqual([]);
    expect(again.batch).toMatchObject({ rowCount: 28, newCount: 0, duplicateCount: 28 });
  });

  it('applies user rules', () => {
    const rule: Rule = {
      id: 'u1',
      source: 'user',
      op: 'equals',
      value: 'EXEMPELBUTIKEN AB',
      categoryId: C.shopping,
      createdAt: '2026-12-01T00:00:00Z',
    };
    const withRule = importCsv(fixture, options({ userRules: [rule] }));
    expect(withRule.transactions.find((t) => t.merchantKey === 'EXEMPELBUTIKEN AB')).toMatchObject({
      categoryId: C.shopping,
      categorySource: 'user_rule',
    });
  });

  it('reports bad rows in the batch', () => {
    const broken = fixture + '\n2026/12/30;abc;;;;Broken row;0,00;SEK;';
    const r = importCsv(broken, options());
    expect(r.batch).toMatchObject({ rowCount: 29, newCount: 28, errorCount: 1 });
    expect(r.errors).toEqual([{ line: 30, message: 'Invalid amount: "abc"' }]);
  });
});

describe('fixture end to end: import → period summaries (hand-checked)', () => {
  const { transactions } = importCsv(fixture, options());
  const summary = (label: string) => summarizePeriod(transactions, DEFAULT_CATEGORIES, label);

  it('October 2026 (Sep 25 – Oct 22): spending without income', () => {
    expect(summary('2026-10')).toMatchObject({
      spentByCategory: { [C.groceries]: 31240, [C.swishPeople]: 25000 },
      netSpending: 56240,
      income: 0,
      leftOver: -56240,
      savingsRate: null,
      movedToSavings: 0,
      needsReview: { count: 0, moneyOut: 0, moneyIn: 0 },
    });
  });

  it('November 2026 (Oct 23 – Nov 24): includes the payday-eve purchase booked on payday', () => {
    expect(summary('2026-11')).toMatchObject({
      spentByCategory: {
        [C.restaurants]: 5800 + 9400,
        [C.gaming]: 19900 + 6500 + 6500,
        [C.transport]: 64500 + 2400,
        [C.subscriptions]: 12900,
        [C.health]: 54600,
        [C.swishFromPeople]: -(12500 + 150000), // money back from people lowers spending
      },
      netSpending: 182500 - 162500,
      income: 1359200 + 100000, // CSN + cash deposit; Swish from people is not income
      leftOver: 1459200 - 20000,
      movedToSavings: 500000 - 200000,
      needsReview: { count: 2, moneyOut: 89900, moneyIn: 16000 },
    });
  });

  it('December 2026 (Nov 25 – Dec 22)', () => {
    expect(summary('2026-12')).toMatchObject({
      spentByCategory: { [C.shopping]: 4550, [C.subscriptions]: 16900, [C.groceries]: 123456 + 41000 },
      netSpending: 185906,
      income: 1359200,
      leftOver: 1359200 - 185906,
      movedToSavings: 0,
      needsReview: { count: 1, moneyOut: 8000, moneyIn: 0 },
    });
  });

  it('January 2027 (Dec 23 – Jan 24): December payday on the 23rd starts January', () => {
    expect(summary('2027-01')).toMatchObject({
      spentByCategory: { [C.restaurants]: 2700 },
      income: 1359200,
      movedToSavings: 500000,
    });
  });

  it('accounts for every transaction in exactly one period', () => {
    const labels = ['2026-10', '2026-11', '2026-12', '2027-01'];
    const counted = labels.map(summary).reduce((n, s) => {
      const categorized = transactions.filter(
        (t) => t.effectiveDate >= s.period.start && t.effectiveDate <= s.period.end,
      ).length;
      return n + categorized;
    }, 0);
    expect(counted).toBe(transactions.length);
  });
});

describe('importCsv format detection', () => {
  it('rejects files no format recognizes', () => {
    expect(() => importCsv('Date,Amount,Description\n2026-11-01,-10.00,Coffee', options())).toThrow(
      UnsupportedFormatError,
    );
  });

  it('uses the detected format to parse, describe and label', () => {
    // A stand-in bank that reuses Nordea's parser but has its own name and description reader.
    const other: BankFormat = {
      ...NORDEA,
      id: 'testbank',
      name: 'Testbank',
      describe: (_description, bookingDate) => ({ kind: 'other', counterparty: 'SAME', effectiveDate: bookingDate }),
    };
    const r = importCsv(fixture, options({ formats: [other] }));
    expect(r.format).toEqual({ id: 'testbank', name: 'Testbank', country: 'SE' });
    expect(r.batch.label).toBe('Testbank · 2026-12-29');
    expect(new Set(r.transactions.map((t) => t.merchantKey))).toEqual(new Set(['SAME']));
  });
});
