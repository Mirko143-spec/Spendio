import { BUILTIN_RULES } from './builtin-rules.ts';
import { CATEGORY_IDS } from './categories.ts';
import type { TransactionKind } from './formats/types.ts';
import { looksLikeBusiness } from './merchant.ts';
import { findBestRule, type Rule } from './rules.ts';

/**
 * Assigns a category to a transaction (docs/SPEC.md §7): user rules, then built-in rules,
 * then defaults by transaction kind, otherwise "Needs review" (null).
 */

export type CategorySource = 'manual' | 'user_rule' | 'builtin_rule' | 'kind_default' | 'none';

export interface CategorizeInput {
  kind: TransactionKind;
  /** Cleaned, uppercased merchant name (`cleanMerchant(...).key`). */
  merchantKey: string;
}

export interface Categorization {
  /** null = Needs review. */
  categoryId: string | null;
  source: Exclude<CategorySource, 'manual'>;
  /** A guess the review screen should still show for confirmation. */
  suggested: boolean;
  /** For Swish: whether the counterparty is a private person rather than a business. */
  counterpartyIsPerson?: boolean;
}

const SWISH_KINDS: ReadonlySet<TransactionKind> = new Set(['swish_out', 'swish_in', 'swish_refund']);

export function categorize(input: CategorizeInput, userRules: readonly Rule[] = []): Categorization {
  const isSwish = SWISH_KINDS.has(input.kind);
  const builtin = findBestRule(BUILTIN_RULES, input);
  // A Swish counterparty is a business if its name says so or a built-in merchant rule knows it.
  const person = isSwish ? { counterpartyIsPerson: !builtin && !looksLikeBusiness(input.merchantKey) } : {};

  const user = findBestRule(userRules, input);
  if (user) return { categoryId: user.categoryId, source: 'user_rule', suggested: false, ...person };
  if (builtin) return { categoryId: builtin.categoryId, source: 'builtin_rule', suggested: false, ...person };

  if (input.kind === 'deposit') return { categoryId: CATEGORY_IDS.income, source: 'kind_default', suggested: false };
  if (input.kind === 'swish_out' && person.counterpartyIsPerson) {
    return { categoryId: CATEGORY_IDS.swishPeople, source: 'kind_default', suggested: true, ...person };
  }
  return { categoryId: null, source: 'none', suggested: false, ...person };
}
