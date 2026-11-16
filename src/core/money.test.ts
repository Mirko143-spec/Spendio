import { describe, expect, it } from 'vitest';
import { formatAmount, parseAmount } from './money.ts';

describe('parseAmount', () => {
  it.each([
    ['-129,00', -12900],
    ['13592,00', 1359200],
    ['601,27', 60127],
    ['-1234,56', -123456],
    ['0,00', 0],
    ['-0,00', 0],
    ['42', 4200],
    ['42,5', 4250],
    ['+160,00', 16000],
  ])('parses Nordea-style %s → %i öre', (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it('accepts thousands separators: space, no-break space, narrow no-break space, dot', () => {
    expect(parseAmount('1 234,56')).toBe(123456);
    expect(parseAmount('1\u00A0234,56')).toBe(123456);
    expect(parseAmount('1\u202F234,56')).toBe(123456);
    expect(parseAmount('1.234.567,89')).toBe(123456789);
  });

  it('accepts the unicode minus sign and surrounding whitespace', () => {
    expect(parseAmount(' \u2212245,50 ')).toBe(-24550);
  });

  it('supports dot as the decimal separator', () => {
    expect(parseAmount('1,234.56', { decimal: '.' })).toBe(123456);
    expect(parseAmount('-129.00', { decimal: '.' })).toBe(-12900);
  });

  it('never goes through floating point', () => {
    // 0.1 + 0.2 style errors would show up as 30.000000000000004 etc.
    expect(parseAmount('0,29')).toBe(29);
    expect(parseAmount('1,13')).toBe(113);
    expect(parseAmount('4,35')).toBe(435);
  });

  it.each(['', '  ', 'abc', '12,345', '1,2,3', '--5', '12 kr', ',50', '5,', '1 23,00', '12 3456,00'])(
    'rejects %j',
    (input) => {
      expect(() => parseAmount(input)).toThrow(/Invalid amount/);
    },
  );

  it('rejects the wrong decimal separator instead of silently misreading it', () => {
    // With comma decimals, '12.50' must not become 1 250 kr.
    expect(() => parseAmount('12.50')).toThrow(/Invalid amount/);
    expect(() => parseAmount('12,50', { decimal: '.' })).toThrow(/Invalid amount/);
    expect(parseAmount('12.50', { decimal: '.' })).toBe(1250);
  });
});

describe('formatAmount', () => {
  const plain = (s: string) => s.replace(/[\u00A0\u202F]/g, ' ').replace(/\u2212/g, '-');

  it.each([
    [123456, '1 234,56 kr'],
    [-12900, '-129,00 kr'],
    [0, '0,00 kr'],
    [1359200, '13 592,00 kr'],
  ])('formats %i öre as %s', (ore, expected) => {
    expect(plain(formatAmount(ore))).toBe(expected);
  });
});
