import { useEffect, useState } from 'react';
import { limitFor, type Budget } from '../../core/budgets.ts';
import type { Category } from '../../core/categories.ts';
import { usageByCategory } from '../../core/category-usage.ts';
import { DEFAULT_COUNTRY } from '../../core/country/index.ts';
import type { Transaction } from '../../core/import.ts';
import { periodOf } from '../../core/periods.ts';
import type { Rule } from '../../core/rules.ts';
import type { AppSettings } from '../../core/settings.ts';
import type { SpendioStore } from '../../storage/store.ts';
import { CategoryEditor } from '../CategoryEditor.tsx';
import { CategoryLimit } from '../CategoryLimit.tsx';
import { DeleteCategory } from '../DeleteCategory.tsx';
import { RulesList } from '../RulesList.tsx';
import { loadWhileMounted } from '../load.ts';
import { newId } from '../new-id.ts';
import { useStore } from '../useStore.ts';

interface Data {
  transactions: Transaction[];
  categories: Category[];
  rules: Rule[];
  budgets: Budget[];
  settings: AppSettings;
}

async function fetchData(store: SpendioStore): Promise<Data> {
  const [transactions, categories, rules, budgets, settings] = await Promise.all([
    store.listTransactions(),
    store.listCategories(),
    store.listUserRules(),
    store.listBudgets(),
    store.getSettings(),
  ]);
  return { transactions, categories, rules, budgets, settings };
}

const context = () => ({ now: new Date().toISOString(), newId: newId });

/** Categories (names, colors, limits) and categorization rules (docs/SPEC.md §12). */
export function CategoriesPage() {
  const store = useStore();
  const [data, setData] = useState<Data | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => loadWhileMounted(() => fetchData(store), setData), [store, version]);

  if (!data) return null;

  const reload = () => setVersion((v) => v + 1);
  const after = (work: Promise<unknown>) => work.then(reload);
  const usage = usageByCategory(data.transactions, data.rules, data.budgets);
  const period = periodOf(new Date().toISOString().slice(0, 10), data.settings);

  return (
    <div className="space-y-14">
      <section aria-labelledby="categories-title">
        <h1 id="categories-title" className="text-title font-semibold tracking-[-0.015em]">
          Categories
        </h1>
        <p className="mt-4 max-w-prose text-ink-muted">
          Rename categories, pick their colors, set monthly limits, or add your own.
        </p>
        <div className="mt-10">
          <CategoryEditor
            categories={data.categories}
            usage={usage}
            onUpdate={(id, changes) => after(store.updateCategory(id, changes))}
            onAdd={(input) => after(store.addCategory(input, newId))}
            renderExtra={(category) => (
              <>
                <CategoryLimit
                  category={category}
                  limit={limitFor(data.budgets, category.id, period)}
                  period={period}
                  onSetLimit={(amount) => after(store.setBudgetLimit(category.id, amount, period, newId))}
                />
                <DeleteCategory
                  category={category}
                  categories={data.categories}
                  usage={usage.get(category.id)}
                  onDelete={(id, moveTo) => after(store.deleteCategory(id, moveTo))}
                />
              </>
            )}
          />
        </div>
      </section>

      <section aria-labelledby="rules-title">
        <h1 id="rules-title" className="text-title font-semibold tracking-[-0.015em]">
          Rules
        </h1>
        <div className="mt-8">
          <RulesList
            userRules={data.rules}
            builtinRules={DEFAULT_COUNTRY.builtinRules}
            countryName={DEFAULT_COUNTRY.name}
            categories={data.categories}
            onChangeCategory={(rule, categoryId) =>
              after(store.saveUserRule({ op: rule.op, value: rule.value, kind: rule.kind, categoryId }, context()))
            }
            onDelete={(id) => after(store.deleteUserRule(id))}
          />
        </div>
      </section>
    </div>
  );
}
