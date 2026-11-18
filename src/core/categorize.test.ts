import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BUILTIN_RULES } from './builtin-rules.ts';
import { CATEGORY_IDS as C, DEFAULT_CATEGORIES } from './categories.ts';
import { categorize } from './categorize.ts';
import { parseNordeaCsv } from './csv/nordea.ts';
import { describeTransaction } from './describe.ts';
import { cleanMerchant } from './merchant.ts';
import type { Rule } from './rules.ts';

const input = (kind: Parameters<typeof categorize>[0]['kind'], name: string) => ({
  kind,
  merchantKey: cleanMerchant(name).key,
});

describe('BUILTIN_RULES', () => {
  it('only point at existing categories and have unique ids', () => {
    const ids = new Set(DEFAULT_CATEGORIES.map((c) => c.id));
    for (const r of BUILTIN_RULES) expect(ids.has(r.categoryId)).toBe(true);
    expect(new Set(BUILTIN_RULES.map((r) => r.id)).size).toBe(BUILTIN_RULES.length);
  });

  it('are stored uppercase, as merchant keys are', () => {
    for (const r of BUILTIN_RULES) expect(r.value).toBe(r.value.toLocaleUpperCase('sv-SE'));
  });
});

describe('categorize with built-in rules', () => {
  it.each([
    ['card', 'ICA NARA VARBY GARD', C.groceries],
    ['card', 'MAXI ICA STORMARKNAD', C.groceries],
    ['card', 'MAX BURGERS 12', C.restaurants],
    ['card', 'Espresso House 398', C.restaurants],
    ['card', 'NMB*Nybergs Konditor', C.restaurants],
    ['card', 'DANIS PIZZERIA', C.restaurants],
    ['card', 'SUSHIARENAN', C.restaurants],
    ['card', 'UBER *EATS', C.restaurants],
    ['card', 'UBER TRIP', C.transport],
    ['card', 'SJ.SE', C.transport],
    ['card', 'ST1 E4 SODER', C.transport],
    ['card', 'PARKSTER SWE', C.transport],
    ['swish_out', 'AB STORSTOCKHOLMS L', C.transport],
    ['card', 'Spotify P4938CFA38', C.subscriptions],
    ['card', 'AMAZON PRIME', C.subscriptions],
    ['card', 'AMAZON MKTPL', C.shopping],
    ['card', 'ANTHROPIC* CLAUDE SU', C.subscriptions],
    ['card', 'WL *STEAM PURCHASE', C.gaming],
    ['card', 'ROBLOX.COM 188885825', C.gaming],
    ['card', 'TEBEX.ORG', C.gaming],
    ['card', 'AHLENS Odenplan', C.shopping],
    ['swish_out', 'INET AB', C.shopping],
    ['autogiro', 'nordicwell', C.health],
    ['card', 'KRONANS APOTEK', C.health],
    ['autogiro', 'Lysa Spar', C.savings],
    ['other', 'LYSA', C.savings],
    ['other', 'Studiestöd', C.income],
  ] as const)('%s %s → %s', (kind, name, categoryId) => {
    expect(categorize(input(kind, name))).toMatchObject({ categoryId, source: 'builtin_rule', suggested: false });
  });

  it('does not let short rules catch unrelated merchants', () => {
    expect(categorize(input('card', 'VOICEBOX AB')).categoryId).toBeNull();
    expect(categorize(input('card', 'SLOTTSKOGEN KIOSK')).categoryId).toBeNull();
    expect(categorize(input('card', 'MAXIMAL GYM')).categoryId).toBeNull();
  });
});

describe('categorize defaults by kind', () => {
  it('treats deposits as income', () => {
    expect(categorize(input('deposit', 'Insättningsautomat'))).toEqual({
      categoryId: C.income,
      source: 'kind_default',
      suggested: false,
    });
  });

  it('suggests "Swish to people" for outgoing Swish to a person', () => {
    expect(categorize(input('swish_out', 'ANNA TESTSSON'))).toEqual({
      categoryId: C.swishPeople,
      source: 'kind_default',
      suggested: true,
      counterpartyIsPerson: true,
    });
  });

  it('leaves incoming Swish from a person for review', () => {
    expect(categorize(input('swish_in', 'DOE,JOHN'))).toEqual({
      categoryId: null,
      source: 'none',
      suggested: false,
      counterpartyIsPerson: true,
    });
  });

  it('leaves Swish to an unknown business for review, and knows it is a business', () => {
    expect(categorize(input('swish_out', 'EXEMPELBUTIKEN AB'))).toEqual({
      categoryId: null,
      source: 'none',
      suggested: false,
      counterpartyIsPerson: false,
    });
  });

  it('gives a Swish refund the category of the counterparty when a rule knows it', () => {
    expect(categorize(input('swish_refund', 'INET AB')).categoryId).toBe(C.shopping);
    expect(categorize(input('swish_refund', 'STIFTELSEN EXEMPELHUSET')).categoryId).toBeNull();
  });

  it('treats a Swish counterparty known to a built-in rule as a business', () => {
    expect(categorize(input('swish_out', 'AB STORSTOCKHOLMS L')).counterpartyIsPerson).toBe(false);
    expect(categorize(input('swish_out', 'SL')).counterpartyIsPerson).toBe(false);
  });

  it('only reports counterpartyIsPerson for Swish', () => {
    expect(categorize(input('card', 'SPOTIFY'))).not.toHaveProperty('counterpartyIsPerson');
  });
});

describe('categorize with user rules', () => {
  const userRule = (overrides: Partial<Rule>): Rule => ({
    id: 'u1',
    source: 'user',
    op: 'equals',
    value: 'X',
    categoryId: C.other,
    createdAt: '2026-11-16T00:00:00Z',
    ...overrides,
  });

  it('override built-in rules', () => {
    const rules = [userRule({ value: 'TEBEX.ORG', categoryId: C.entertainment })];
    expect(categorize(input('card', 'TEBEX.ORG'), rules)).toMatchObject({ categoryId: C.entertainment, source: 'user_rule' });
  });

  it('can tag a Swish person, limited to one direction', () => {
    const rules = [userRule({ value: 'ANNA TESTSSON', kind: 'swish_in', categoryId: C.restaurants })];
    expect(categorize(input('swish_in', 'ANNA TESTSSON'), rules)).toEqual({
      categoryId: C.restaurants,
      source: 'user_rule',
      suggested: false,
      counterpartyIsPerson: true,
    });
    expect(categorize(input('swish_out', 'ANNA TESTSSON'), rules).categoryId).toBe(C.swishPeople);
  });

  it('can match bank-truncated names with startsWith', () => {
    const rules = [userRule({ op: 'startsWith', value: 'STIFTELSEN TEKN', categoryId: C.entertainment })];
    expect(categorize(input('swish_out', 'STIFTELSEN TEKNISKA'), rules).categoryId).toBe(C.entertainment);
    expect(categorize(input('swish_refund', 'STIFTELSEN TEKN'), rules).categoryId).toBe(C.entertainment);
  });
});

describe('categorize on the fixture', () => {
  const fixture = readFileSync(join(import.meta.dirname, '../../fixtures/nordea-sample.csv'), 'utf8');
  const results = parseNordeaCsv(fixture).rows.map((r) => {
    const d = describeTransaction(r.description, r.bookingDate);
    return [r.description, categorize({ kind: d.kind, merchantKey: cleanMerchant(d.counterparty).key }).categoryId];
  });

  it('assigns the expected category to every row', () => {
    expect(Object.fromEntries(results)).toEqual({
      'Kortköp 261227 Pressbyran 4200001': C.restaurants,
      'Autogiro Lysa Spar': C.savings,
      Studiestöd: C.income,
      'Kortköp 261221 ICA NARA EXEMPEL': C.groceries,
      'Kortköp 261209 COOP EXEMPELSTAD': C.groceries,
      'Kortköp 261201 Netflix.com': C.subscriptions,
      'Kortköp 261126 SOSTRENE GRENE DROTT': C.shopping,
      'Kortköp 261125 PAYPAL_*EXEMPELSHOP': null,
      'Kortköp 261124 PARKSTER SWE': C.transport,
      Insättningsautomat: C.income,
      'Autogiro nordicwell': C.health,
      'Swish inbetalning DOE,JOHN': null,
      'Swish återbetalning STIFTELSEN EXEMPELHUSET': null,
      LYSA: C.savings,
      'Kortköp 261104 NMB*Exempel Konditori': C.restaurants,
      'Kortköp 261103 Spotify P1234ABCD5': C.subscriptions,
      'Kortköp 261102 ROBLOX.COM 188885825': C.gaming,
      'Kortköp 261031 SJ.SE': C.transport,
      'Swish betalning EXEMPELBUTIKEN AB': null,
      'Swish inbetalning ANNA TESTSSON': null,
      'Kortköp 261025 WL *STEAM PURCHASE': C.gaming,
      'Kortköp 261023 Espresso House 123': C.restaurants,
      'Swish betalning ANNA TESTSSON': C.swishPeople,
      'Kortköp 261019 ICA SUPERMARKET TESTBY': C.groceries,
    });
  });
});
