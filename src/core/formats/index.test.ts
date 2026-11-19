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

  it('registers each layout once; layouts sharing an id are the same bank', () => {
    expect(new Set(BANK_FORMATS).size).toBe(BANK_FORMATS.length);
    // A bank can have several layouts (CSV, PDF). They share the id, so they're one account.
    for (const a of BANK_FORMATS) for (const b of BANK_FORMATS) if (a.id === b.id) expect(a.name).toBe(b.name);
  });
});
