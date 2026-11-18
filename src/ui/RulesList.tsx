import type { Category } from '../core/categories.ts';
import type { Rule } from '../core/rules.ts';
import { describeRule } from './format.ts';

interface RulesListProps {
  userRules: readonly Rule[];
  builtinRules: readonly Rule[];
  /** Country name for the built-in rules heading, e.g. "Sweden". */
  countryName: string;
  categories: readonly Category[];
  onChangeCategory: (rule: Rule, categoryId: string) => Promise<void>;
  onDelete: (ruleId: string) => Promise<void>;
}

/** Your rules (editable) and the built-in ones (read-only), docs/SPEC.md §7. */
export function RulesList({ userRules, builtinRules, countryName, categories, onChangeCategory, onDelete }: RulesListProps) {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const newestFirst = [...userRules].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  // Built-in rules for a deleted category are not used, so they are not shown either.
  const activeBuiltins = builtinRules.filter((r) => byId.has(r.categoryId));

  return (
    <div className="space-y-10">
      <section aria-labelledby="user-rules-title">
        <h2 id="user-rules-title" className="text-lg font-semibold">
          Your rules
        </h2>
        <p className="mt-1 max-w-prose text-sm text-ink-muted">
          Spendio creates these when you tick “Remember” in review or choose “All from…” on a transaction. Your rules
          always win over the built-in ones, and changes apply to future imports.
        </p>
        {newestFirst.length === 0 ? (
          <p className="mt-4 text-ink-muted">No rules yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {newestFirst.map((rule) => (
              <li key={rule.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                <span className="min-w-0 break-words">{describeRule(rule)}</span>
                <span className="flex items-center gap-4">
                  <select
                    aria-label={`Category for rule: ${describeRule(rule)}`}
                    value={rule.categoryId}
                    onChange={(e) => void onChangeCategory(rule, e.target.value)}
                    className="rounded-lg border border-line bg-surface-raised px-3 py-1.5 text-sm"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void onDelete(rule.id)}
                    aria-label={`Delete rule: ${describeRule(rule)}`}
                    className="text-sm font-medium text-ink-muted hover:text-danger"
                  >
                    Delete
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="builtin-rules-title">
        <details>
          <summary id="builtin-rules-title" className="cursor-pointer text-lg font-semibold">
            Built-in rules for {countryName} ({activeBuiltins.length})
          </summary>
          <p className="mt-2 max-w-prose text-sm text-ink-muted">
            Common shops and services Spendio recognizes on its own. They can’t be edited, but any rule of yours for the
            same merchant takes priority.
          </p>
          <div className="mt-4 space-y-4">
            {groupByCategory(activeBuiltins).map(([categoryId, rules]) => (
              <div key={categoryId}>
                <h3 className="font-medium">{byId.get(categoryId)?.name ?? categoryId}</h3>
                <p className="mt-1 text-sm text-ink-muted">{[...new Set(rules.map((r) => r.value.trim()))].join(', ')}</p>
              </div>
            ))}
          </div>
        </details>
      </section>
    </div>
  );
}

function groupByCategory(rules: readonly Rule[]): [string, Rule[]][] {
  const groups = new Map<string, Rule[]>();
  for (const rule of rules) groups.set(rule.categoryId, [...(groups.get(rule.categoryId) ?? []), rule]);
  return [...groups];
}
