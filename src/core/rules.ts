import type { TransactionKind } from './describe.ts';

/**
 * Categorization rules and their priority (docs/SPEC.md §7.1–7.2).
 *
 * A rule matches a transaction's merchant key (uppercased, cleaned merchant name), optionally
 * only for one transaction kind. Matching is a plain case-insensitive string comparison, no regex.
 */

export type MatchOp = 'equals' | 'startsWith' | 'contains';

export interface Rule {
  id: string;
  source: 'user' | 'builtin';
  op: MatchOp;
  value: string;
  /** Only match transactions of this kind (e.g. a Swish rule for one person). */
  kind?: TransactionKind;
  categoryId: string;
  /** ISO timestamp; newer rules win ties. */
  createdAt: string;
}

export interface RuleTarget {
  merchantKey: string;
  kind: TransactionKind;
}

const normalize = (s: string) => s.toLocaleUpperCase('sv-SE');

export function ruleMatches(rule: Rule, target: RuleTarget): boolean {
  if (rule.kind && rule.kind !== target.kind) return false;
  const key = normalize(target.merchantKey);
  const value = normalize(rule.value);
  if (!value) return false;
  switch (rule.op) {
    case 'equals':
      return key === value;
    case 'startsWith':
      return key.startsWith(value);
    case 'contains':
      return key.includes(value);
  }
}

const SOURCE_RANK: Record<Rule['source'], number> = { user: 0, builtin: 1 };
const OP_RANK: Record<MatchOp, number> = { equals: 0, startsWith: 1, contains: 2 };

/**
 * Orders matching rules from strongest to weakest:
 * user before built-in; then equals > startsWith > contains; then a kind-restricted rule;
 * then the longer pattern; then the newer rule; then id (so the result is deterministic).
 */
function compareRules(a: Rule, b: Rule): number {
  return (
    SOURCE_RANK[a.source] - SOURCE_RANK[b.source] ||
    OP_RANK[a.op] - OP_RANK[b.op] ||
    Number(Boolean(b.kind)) - Number(Boolean(a.kind)) ||
    b.value.length - a.value.length ||
    b.createdAt.localeCompare(a.createdAt) ||
    a.id.localeCompare(b.id)
  );
}

/** The strongest rule that matches `target`, or undefined. */
export function findBestRule(rules: readonly Rule[], target: RuleTarget): Rule | undefined {
  let best: Rule | undefined;
  for (const rule of rules) {
    if (ruleMatches(rule, target) && (!best || compareRules(rule, best) < 0)) best = rule;
  }
  return best;
}
