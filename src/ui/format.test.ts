import { describe, expect, it } from 'vitest';
import { amountParts, dateRange, groupContext, groupTitle, listNames, periodName } from './format.ts';

describe('amountParts', () => {
  it('splits sign, Swedish-formatted number and currency', () => {
    const plain = (s: string) => s.replace(/[\u00A0\u202F]/g, ' ');
    const out = amountParts(-123456);
    expect([out.sign, plain(out.number), out.currency]).toEqual(['−', '1 234,56', 'kr']);
    expect(amountParts(12500).sign).toBe('+');
    expect(amountParts(0).sign).toBe('');
  });
});

describe('dateRange', () => {
  it.each([
    ['2026-10-27', '2026-10-27', '27 Oct'],
    ['2026-11-03', '2026-11-10', '3–10 Nov'],
    ['2026-10-25', '2026-11-09', '25 Oct – 9 Nov'],
  ])('%s to %s → %s', (a, b, expected) => {
    expect(dateRange(a, b)).toBe(expected);
  });
});

describe('groupTitle / groupContext', () => {
  it('names groups the way people talk about them', () => {
    expect(groupTitle({ kind: 'swish_out', merchantDisplay: 'ANNA' })).toBe('Swish to ANNA');
    expect(groupTitle({ kind: 'autogiro', merchantDisplay: 'nordicwell' })).toBe('Direct debit to nordicwell');
    expect(groupTitle({ kind: 'card', merchantDisplay: 'TEBEX.ORG' })).toBe('TEBEX.ORG');
  });

  it('counts with the right noun', () => {
    expect(groupContext({ kind: 'card', transactionIds: ['a', 'b'], firstDate: '2026-11-03', lastDate: '2026-11-10' })).toBe(
      '2 purchases, 3–10 Nov',
    );
    expect(groupContext({ kind: 'swish_refund', transactionIds: ['a'], firstDate: '2026-11-12', lastDate: '2026-11-12' })).toBe(
      '1 refund, 12 Nov',
    );
  });
});

describe('groupTitle for people', () => {
  it('tidies person names but leaves businesses as the bank wrote them', () => {
    expect(groupTitle({ kind: 'swish_in', merchantDisplay: 'DOE,JOHN', isPerson: true })).toBe('Swish from John Doe');
    expect(groupTitle({ kind: 'swish_out', merchantDisplay: 'EXEMPELBUTIKEN AB', isPerson: false })).toBe(
      'Swish to EXEMPELBUTIKEN AB',
    );
  });
});

describe('listNames', () => {
  it('joins names in plain English', () => {
    expect(listNames(['Nordea'])).toBe('Nordea');
    expect(listNames(['Nordea', 'SEB'])).toBe('Nordea and SEB');
    expect(listNames(['Nordea', 'SEB', 'Swedbank'])).toBe('Nordea, SEB and Swedbank');
  });
});

describe('periodName', () => {
  it('names a period label', () => {
    expect(periodName('2026-11')).toBe('November 2026');
    expect(periodName('2027-01', true)).toBe('Jan');
  });
});
