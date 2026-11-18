import { describe, expect, it } from 'vitest';
import { accountForFormat } from './account.ts';
import { NORDEA } from './formats/nordea/index.ts';

describe('accountForFormat', () => {
  it('names the account after the bank, without any account number', () => {
    expect(accountForFormat(NORDEA)).toEqual({ id: 'account:nordea', bank: 'nordea', name: 'Nordea' });
  });

  it('gives each bank format its own account', () => {
    expect(accountForFormat({ id: 'seb', name: 'SEB' }).id).not.toBe(accountForFormat(NORDEA).id);
  });
});
