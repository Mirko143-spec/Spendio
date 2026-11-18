import type { BankFormat } from './formats/types.ts';

/**
 * Bank accounts. A fresh install has none: the first import from a bank creates its account.
 * v1 keeps one account per bank format; every transaction carries its account id, so several
 * accounts per bank can be added later without a migration (docs/SPEC.md §3, §8).
 *
 * Never stores account numbers.
 */

export interface Account {
  id: string;
  /** Id of the bank format the account's statements are imported with (e.g. "nordea"). */
  bank: string;
  name: string;
}

/** The account that imports in `format` belong to. */
export function accountForFormat(format: Pick<BankFormat, 'id' | 'name'>): Account {
  return { id: `account:${format.id}`, bank: format.id, name: format.name };
}
