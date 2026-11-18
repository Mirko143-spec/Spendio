import { describe, expect, it } from 'vitest';
import { BANK_FORMATS, detectFormat } from './index.ts';
import { NORDEA } from './nordea/index.ts';
import type { BankFormat } from './types.ts';

describe('detectFormat', () => {
  it('recognizes a Nordea export', () => {
    expect(detectFormat('Bokföringsdag;Belopp;Avsändare;Mottagare;Namn;Rubrik;Saldo;Valuta;\n')).toBe(NORDEA);
  });

  it('returns undefined for an unknown layout', () => {
    expect(detectFormat('Date,Amount,Description\n')).toBeUndefined();
  });

  it('checks formats in order and accepts a custom list', () => {
    const always: BankFormat = { ...NORDEA, id: 'always', detect: () => true };
    expect(detectFormat('anything', [always, NORDEA])).toBe(always);
  });

  it('registers each format once with a unique id', () => {
    expect(new Set(BANK_FORMATS.map((f) => f.id)).size).toBe(BANK_FORMATS.length);
  });
});
