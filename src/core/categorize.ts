import { CATEGORY_IDS } from './categories.ts';
import { DEFAULT_COUNTRY } from './country/index.ts';
import type { Country } from './country/types.ts';
import type { TransactionKind } from './formats/types.ts';
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

/**
 * @param existingCategoryIds Categories that exist. Rules and defaults pointing at a deleted
 *   category are skipped (the transaction goes to Needs review instead of a category that is
 *   gone). Omit to allow every category.
 */
export function categorize(
  input: CategorizeInput,
  userRules: readonly Rule[] = [],
  country: Country = DEFAULT_COUNTRY,
  existingCategoryIds?: ReadonlySet<string>,
): Categorization {
  const exists = (id: string) => !existingCategoryIds || existingCategoryIds.has(id);
  const isSwish = SWISH_KINDS.has(input.kind);
  // A Swish counterparty is a business if its name says so or a built-in merchant rule knows it
  // (even one whose category was deleted: it's still a business).
  const knownMerchant = findBestRule(country.builtinRules, input);
  const person = isSwish ? { counterpartyIsPerson: !knownMerchant && !country.looksLikeBusiness(input.merchantKey) } : {};

  const user = findBestRule(userRules.filter((r) => exists(r.categoryId)), input);
  if (user) return { categoryId: user.categoryId, source: 'user_rule', suggested: false, ...person };
  const builtin = findBestRule(country.builtinRules.filter((r) => exists(r.categoryId)), input);
  if (builtin) return { categoryId: builtin.categoryId, source: 'builtin_rule', suggested: false, ...person };

  if (input.kind === 'deposit') return { categoryId: CATEGORY_IDS.income, source: 'kind_default', suggested: false };
  if (input.kind === 'swish_out' && person.counterpartyIsPerson && exists(CATEGORY_IDS.swishPeople)) {
    return { categoryId: CATEGORY_IDS.swishPeople, source: 'kind_default', suggested: true, ...person };
  }
  if (input.kind === 'swish_in' && person.counterpartyIsPerson && exists(CATEGORY_IDS.swishFromPeople)) {
    return { categoryId: CATEGORY_IDS.swishFromPeople, source: 'kind_default', suggested: true, ...person };
  }
  return { categoryId: null, source: 'none', suggested: false, ...person };
}
