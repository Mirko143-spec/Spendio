import { describe, expect, it } from 'vitest';
import { categorize } from '../categorize.ts';
import { CATEGORY_IDS as C } from '../categories.ts';
import { formatAmount } from '../money.ts';
import { payday } from '../periods.ts';
import { COUNTRIES, countryFor, DEFAULT_COUNTRY } from './index.ts';
import { SWEDEN } from './se/index.ts';
import type { Country } from './types.ts';

describe('country registry', () => {
  it('supports Sweden only in v1, as the default', () => {
    expect(Object.keys(COUNTRIES)).toEqual(['SE']);
    expect(DEFAULT_COUNTRY).toBe(SWEDEN);
    expect(countryFor('SE')).toBe(SWEDEN);
  });

  it('rejects unknown countries', () => {
    expect(() => countryFor('XX')).toThrow(/Unsupported country: XX/);
  });

  it('defines Sweden', () => {
    expect(SWEDEN).toMatchObject({
      code: 'SE',
      currency: 'SEK',
      locale: 'sv-SE',
      defaultPeriodSettings: { startDay: 25, adjustToBankingDay: true },
    });
    expect(SWEDEN.isBankingDay('2026-12-24')).toBe(false);
    expect(SWEDEN.redactPersonalIds('ref 121212-1212')).toBe('ref [redacted]');
    expect(SWEDEN.looksLikeBusiness('EXEMPEL AB')).toBe(true);
  });
});

describe('the core reads country specifics through Country', () => {
  // A made-up country: banks open every day, one merchant rule, euro formatting.
  const testland: Country = {
    code: 'TL',
    name: 'Testland',
    currency: 'EUR',
    locale: 'de-DE',
    defaultPeriodSettings: { startDay: 1, adjustToBankingDay: false },
    isBankingDay: () => true,
    builtinRules: [
      { id: 'tl', source: 'builtin', op: 'equals', value: 'TESTMART', categoryId: C.groceries, createdAt: '2026-01-01' },
    ],
    redactPersonalIds: (text) => text,
    looksLikeBusiness: (name) => name.endsWith(' GMBH'),
  };

  it('uses its banking days for paydays', () => {
    // Sweden moves Dec 25, 2026 back to the 23rd; Testland keeps the 25th.
    expect(payday(2026, 12, { startDay: 25, adjustToBankingDay: true }, testland)).toBe('2026-12-25');
    expect(payday(2026, 12, { startDay: 25, adjustToBankingDay: true })).toBe('2026-12-23');
  });

  it('uses its built-in rules and business markers', () => {
    expect(categorize({ kind: 'card', merchantKey: 'TESTMART' }, [], testland).categoryId).toBe(C.groceries);
    expect(categorize({ kind: 'card', merchantKey: 'ICA NARA' }, [], testland).categoryId).toBeNull();
    expect(categorize({ kind: 'swish_out', merchantKey: 'EXEMPEL GMBH' }, [], testland).counterpartyIsPerson).toBe(false);
  });

  it('uses its currency and locale for formatting', () => {
    expect(formatAmount(123456, testland).replace(/\u00A0/g, ' ')).toBe('1.234,56 €');
  });
});
