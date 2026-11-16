/**
 * Categories (docs/SPEC.md §6). Flat and user-editable, plus three system categories
 * that never count as spending: Income, Transfer: Savings and Transfer: Internal.
 *
 * "Needs review" is not a category: it's a transaction with `categoryId === null`.
 */

export type CategoryType = 'spending' | 'income' | 'transfer';
export type TransferKind = 'savings' | 'internal';

export interface Category {
  id: string;
  name: string;
  /** Hex color, `#rrggbb`. */
  color: string;
  type: CategoryType;
  transferKind?: TransferKind;
  /** System categories can't be deleted. */
  system: boolean;
}

/** Stable ids, so built-in rules and stored data can refer to default categories. */
export const CATEGORY_IDS = {
  groceries: 'groceries',
  restaurants: 'restaurants',
  transport: 'transport',
  shopping: 'shopping',
  subscriptions: 'subscriptions',
  gaming: 'gaming',
  entertainment: 'entertainment',
  health: 'health',
  housing: 'housing',
  travel: 'travel',
  swishPeople: 'swish-people',
  other: 'other',
  income: 'income',
  savings: 'transfer-savings',
  internal: 'transfer-internal',
} as const;

const spending = (id: string, name: string, color: string): Category => ({ id, name, color, type: 'spending', system: false });

export const DEFAULT_CATEGORIES: readonly Category[] = [
  spending(CATEGORY_IDS.groceries, 'Groceries', '#16a34a'),
  spending(CATEGORY_IDS.restaurants, 'Restaurants & Cafés', '#ea580c'),
  spending(CATEGORY_IDS.transport, 'Transport', '#2563eb'),
  spending(CATEGORY_IDS.shopping, 'Shopping', '#db2777'),
  spending(CATEGORY_IDS.subscriptions, 'Subscriptions', '#7c3aed'),
  spending(CATEGORY_IDS.gaming, 'Gaming', '#0891b2'),
  spending(CATEGORY_IDS.entertainment, 'Entertainment', '#ca8a04'),
  spending(CATEGORY_IDS.health, 'Health & Fitness', '#059669'),
  spending(CATEGORY_IDS.housing, 'Housing & Bills', '#475569'),
  spending(CATEGORY_IDS.travel, 'Travel', '#0d9488'),
  spending(CATEGORY_IDS.swishPeople, 'Swish to people', '#9333ea'),
  spending(CATEGORY_IDS.other, 'Other', '#78716c'),
  { id: CATEGORY_IDS.income, name: 'Income', color: '#15803d', type: 'income', system: true },
  { id: CATEGORY_IDS.savings, name: 'Transfer: Savings', color: '#0369a1', type: 'transfer', transferKind: 'savings', system: true },
  { id: CATEGORY_IDS.internal, name: 'Transfer: Internal', color: '#64748b', type: 'transfer', transferKind: 'internal', system: true },
];

export function countsAsSpending(category: Category): boolean {
  return category.type === 'spending';
}

export function isSavingsTransfer(category: Category): boolean {
  return category.type === 'transfer' && category.transferKind === 'savings';
}
