/**
 * Bank accounts. v1 has a single Nordea account; the field exists on every transaction so
 * more accounts can be added later without a migration (docs/SPEC.md §3, §8).
 *
 * Never stores account numbers.
 */

export interface Account {
  id: string;
  bank: 'nordea' | 'generic';
  name: string;
}

export const DEFAULT_ACCOUNT: Account = { id: 'nordea-personkonto', bank: 'nordea', name: 'Personkonto' };
