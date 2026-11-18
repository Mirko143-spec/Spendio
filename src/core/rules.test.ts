import { describe, expect, it } from 'vitest';
import { findBestRule, ruleMatches, type Rule } from './rules.ts';

let seq = 0;
const rule = (overrides: Partial<Rule>): Rule => ({
  id: `r${++seq}`,
  source: 'builtin',
  op: 'equals',
  value: 'X',
  categoryId: 'other',
  createdAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

const card = (merchantKey: string) => ({ merchantKey, kind: 'card' as const });

describe('ruleMatches', () => {
  it.each([
    ['equals', 'SPOTIFY', 'SPOTIFY', true],
    ['equals', 'SPOTIFY', 'SPOTIFY FAMILY', false],
    ['startsWith', 'ICA', 'ICA NARA VARBY GARD', true],
    ['startsWith', 'ICA', 'MAXI ICA', false],
    ['startsWith', 'STIFTELSEN TEKN', 'STIFTELSEN TEKNISKA', true], // bank-truncated names
    ['contains', 'PIZZERIA', 'DANIS PIZZERIA', true],
    ['contains', 'SUSHI', 'SUSHIARENAN', true],
  ] as const)('%s %s vs %s → %s', (op, value, key, expected) => {
    expect(ruleMatches(rule({ op, value }), card(key))).toBe(expected);
  });

  it('is case-insensitive, including Swedish letters', () => {
    expect(ruleMatches(rule({ op: 'equals', value: 'hemköp' }), card('HEMKÖP'))).toBe(true);
  });

  it('respects a kind restriction', () => {
    const r = rule({ op: 'equals', value: 'ANNA TESTSSON', kind: 'swish_out' });
    expect(ruleMatches(r, { merchantKey: 'ANNA TESTSSON', kind: 'swish_out' })).toBe(true);
    expect(ruleMatches(r, { merchantKey: 'ANNA TESTSSON', kind: 'swish_in' })).toBe(false);
  });

  it('never matches with an empty value', () => {
    expect(ruleMatches(rule({ op: 'contains', value: '' }), card('ANYTHING'))).toBe(false);
  });
});

describe('findBestRule priority', () => {
  const target = card('ICA NARA EXEMPEL');

  it('returns undefined when nothing matches', () => {
    expect(findBestRule([rule({ value: 'COOP' })], target)).toBeUndefined();
  });

  it('prefers user rules over built-in rules, even weaker ones', () => {
    const builtin = rule({ op: 'equals', value: 'ICA NARA EXEMPEL' });
    const user = rule({ source: 'user', op: 'contains', value: 'ICA' });
    expect(findBestRule([builtin, user], target)).toBe(user);
  });

  it('prefers equals over startsWith over contains', () => {
    const contains = rule({ op: 'contains', value: 'NARA' });
    const startsWith = rule({ op: 'startsWith', value: 'ICA' });
    const equals = rule({ op: 'equals', value: 'ICA NARA EXEMPEL' });
    expect(findBestRule([contains, startsWith], target)).toBe(startsWith);
    expect(findBestRule([contains, startsWith, equals], target)).toBe(equals);
  });

  it('prefers a kind-restricted rule over an unrestricted one', () => {
    const any = rule({ op: 'startsWith', value: 'ICA NARA' });
    const cardOnly = rule({ op: 'startsWith', value: 'ICA', kind: 'card' });
    expect(findBestRule([any, cardOnly], target)).toBe(cardOnly);
  });

  it('prefers the longer pattern', () => {
    const short = rule({ op: 'startsWith', value: 'ICA' });
    const long = rule({ op: 'startsWith', value: 'ICA NARA' });
    expect(findBestRule([short, long], target)).toBe(long);
  });

  it('prefers the newer rule on a full tie', () => {
    const older = rule({ source: 'user', op: 'startsWith', value: 'ICA', createdAt: '2026-01-01T00:00:00Z' });
    const newer = rule({ source: 'user', op: 'startsWith', value: 'ICA', createdAt: '2026-02-01T00:00:00Z' });
    expect(findBestRule([older, newer], target)).toBe(newer);
    expect(findBestRule([newer, older], target)).toBe(newer);
  });

  it('is deterministic regardless of input order', () => {
    const a = rule({ id: 'a', op: 'startsWith', value: 'ICA' });
    const b = rule({ id: 'b', op: 'startsWith', value: 'ICA' });
    expect(findBestRule([a, b], target)).toBe(findBestRule([b, a], target));
  });
});
