import type { Account } from '../core/account.ts';
import { setLimit, type Budget } from '../core/budgets.ts';
import { createBackup, type Backup } from '../core/backup.ts';
import { DEFAULT_CATEGORIES, type Category } from '../core/categories.ts';
import { BANK_FORMATS } from '../core/formats/index.ts';
import { formatFromMapping } from '../core/formats/generic.ts';
import type { CsvMapping } from '../core/csv/mapping.ts';
import { importCsv, type ImportBatch, type ImportResult, type Transaction } from '../core/import.ts';
import type { Ore } from '../core/money.ts';
import { payday, type PeriodLabel, type PeriodSettings } from '../core/periods.ts';
import type { TransactionKind } from '../core/formats/types.ts';
import type { ReviewDecision } from '../core/review.ts';
import { isSampleBatch, SAMPLE_DATA_LABEL } from '../core/sample.ts';
import type { MatchOp, Rule } from '../core/rules.ts';
import { DEFAULT_SETTINGS, SCHEMA_VERSION, type AppSettings } from '../core/settings.ts';
import { DEFAULT_DB_NAME, SpendioDB } from './db.ts';

export interface ImportContext {
  /** ISO timestamp of the import. */
  now: string;
  newId: () => string;
  /** Overrides the batch label (e.g. sample data). */
  label?: string;
}

export interface DateRange {
  /** Inclusive ISO dates. */
  start: string;
  end: string;
}

/**
 * The app's storage API. UI code talks to this, never to Dexie directly, so the storage layer
 * can change (encryption in v1.1, sync later) without touching callers.
 */
export class SpendioStore {
  readonly db: SpendioDB;

  constructor(db: SpendioDB) {
    this.db = db;
  }

  close(): void {
    this.db.close();
  }

  listAccounts(): Promise<Account[]> {
    return this.db.accounts.toArray();
  }

  /** Categories sorted by name (Swedish collation), so pickers and lists read alphabetically. */
  async listCategories(): Promise<Category[]> {
    const categories = await this.db.categories.toArray();
    return categories.sort((a, b) => a.name.localeCompare(b.name, 'sv'));
  }

  async getSettings(): Promise<AppSettings> {
    const row = await this.db.settings.get('app');
    if (!row) return { ...DEFAULT_SETTINGS };
    return { startDay: row.startDay, adjustToBankingDay: row.adjustToBankingDay, schemaVersion: row.schemaVersion };
  }

  // ── Imports ────────────────────────────────────────────────────────────────

  /**
   * Imports a bank CSV in any supported format: reads existing fingerprints and user rules, runs
   * the pure import pipeline and saves the result, all in one IndexedDB transaction. Either
   * everything is saved or nothing is. A batch with no new rows is reported but not stored.
   * Throws `UnsupportedFormatError` when no format recognizes the file.
   */
  importCsv(text: string, context: ImportContext): Promise<ImportResult> {
    const { db } = this;
    const tables = [db.transactions, db.importBatches, db.rules, db.accounts, db.categories, db.csvMappings];
    return db.transaction('rw', tables, async () => {
      // Bank presets first, then the layouts the person mapped themselves.
      const formats = [...BANK_FORMATS, ...(await db.csvMappings.toArray()).map(formatFromMapping)];
      const existingFingerprints = new Set(await db.transactions.orderBy('fingerprint').keys()) as Set<string>;
      const userRules = await db.rules.toArray();
      const categoryIds = new Set(await db.categories.toCollection().primaryKeys());
      const result = importCsv(text, {
        existingFingerprints,
        userRules,
        categoryIds,
        formats,
        now: context.now,
        newId: context.newId,
        ...(context.label ? { label: context.label } : {}),
      });
      if (result.transactions.length > 0) {
        if (!(await db.accounts.get(result.account.id))) await db.accounts.add(result.account);
        await db.importBatches.add(result.batch);
        await db.transactions.bulkAdd(result.transactions);
      }
      return result;
    });
  }

  /** Imports the bundled sample statement, labelled so it can be told apart and removed. */
  loadSampleData(text: string, context: Omit<ImportContext, 'label'>): Promise<ImportResult> {
    return this.importCsv(text, { ...context, label: SAMPLE_DATA_LABEL });
  }

  /** Removes every sample-data import and its transactions. Returns how many transactions were removed. */
  async removeSampleData(): Promise<number> {
    const { db } = this;
    return db.transaction('rw', db.transactions, db.importBatches, async () => {
      let removed = 0;
      for (const batch of (await db.importBatches.toArray()).filter(isSampleBatch)) removed += await this.deleteImportBatch(batch.id);
      return removed;
    });
  }

  /** Import batches, newest first. */
  listImportBatches(): Promise<ImportBatch[]> {
    return this.db.importBatches.orderBy('importedAt').reverse().toArray();
  }

  /** Undo an import: deletes the batch and all of its transactions. Returns how many were removed. */
  deleteImportBatch(batchId: string): Promise<number> {
    const { db } = this;
    return db.transaction('rw', db.transactions, db.importBatches, async () => {
      const removed = await db.transactions.where('importBatchId').equals(batchId).delete();
      await db.importBatches.delete(batchId);
      return removed;
    });
  }

  // ── CSV mappings ───────────────────────────────────────────────────────────

  /** Saved layouts for files no bank preset recognizes, newest first. */
  async listCsvMappings(): Promise<CsvMapping[]> {
    return (await this.db.csvMappings.toArray()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /** Saves a mapping; a mapping for the same header row is replaced (one mapping per layout). */
  async saveCsvMapping(mapping: CsvMapping): Promise<void> {
    const { db } = this;
    if (!mapping.name.trim()) throw new Error('Give the bank a name');
    await db.transaction('rw', db.csvMappings, async () => {
      await db.csvMappings.where('headerSignature').equals(mapping.headerSignature).delete();
      await db.csvMappings.add({ ...mapping, name: mapping.name.trim() });
    });
  }

  /** Forgets a layout. Transactions already imported with it stay. */
  async deleteCsvMapping(id: string): Promise<void> {
    await this.db.csvMappings.delete(id);
  }

  // ── Transactions ───────────────────────────────────────────────────────────

  countTransactions(): Promise<number> {
    return this.db.transactions.count();
  }

  /** Transactions by effective date (oldest first), optionally limited to a date range. */
  listTransactions(range?: DateRange): Promise<Transaction[]> {
    const byDate = this.db.transactions.orderBy('effectiveDate');
    if (!range) return byDate.toArray();
    return this.db.transactions.where('effectiveDate').between(range.start, range.end, true, true).sortBy('effectiveDate');
  }

  /**
   * Sets a transaction's category by hand. Manual choices are never overwritten by rules or
   * re-imports. `null` puts it back in Needs review.
   */
  async setTransactionCategory(transactionId: string, categoryId: string | null): Promise<void> {
    const { db } = this;
    await db.transaction('rw', db.transactions, db.categories, async () => {
      if (categoryId !== null && !(await db.categories.get(categoryId))) {
        throw new Error(`Unknown category: ${categoryId}`);
      }
      const updated = await db.transactions.update(transactionId, {
        categoryId,
        categorySource: categoryId === null ? 'none' : 'manual',
        suggested: false,
      });
      if (!updated) throw new Error(`Unknown transaction: ${transactionId}`);
    });
  }

  // ── Categories ─────────────────────────────────────────────────────────────

  /** Adds a spending category. Names must be unique (case-insensitive). */
  async addCategory(input: { name: string; color: string }, newId: () => string): Promise<Category> {
    const { db } = this;
    return db.transaction('rw', db.categories, async () => {
      const category: Category = {
        id: newId(),
        name: await this.validName(input.name),
        color: validColor(input.color),
        type: 'spending',
        system: false,
      };
      await db.categories.add(category);
      return category;
    });
  }

  /** Renames or recolors a category. Its type never changes; system categories can be renamed too. */
  async updateCategory(id: string, changes: { name?: string; color?: string }): Promise<Category> {
    const { db } = this;
    return db.transaction('rw', db.categories, async () => {
      const category = await db.categories.get(id);
      if (!category) throw new Error(`Unknown category: ${id}`);
      const updated: Category = {
        ...category,
        ...(changes.name !== undefined ? { name: await this.validName(changes.name, id) } : {}),
        ...(changes.color !== undefined ? { color: validColor(changes.color) } : {}),
      };
      await db.categories.put(updated);
      return updated;
    });
  }

  /**
   * Deletes a category, moving its transactions and rules to `moveToId`. Its budget limits are
   * removed. System categories can't be deleted.
   */
  async deleteCategory(id: string, moveToId: string): Promise<void> {
    const { db } = this;
    await db.transaction('rw', db.categories, db.transactions, db.rules, db.budgets, async () => {
      const category = await db.categories.get(id);
      if (!category) throw new Error(`Unknown category: ${id}`);
      if (category.system) throw new Error(`System category "${category.name}" can't be deleted`);
      if (moveToId === id || !(await db.categories.get(moveToId))) {
        throw new Error(`Invalid category to move transactions to: ${moveToId}`);
      }
      await db.transactions.where('categoryId').equals(id).modify({ categoryId: moveToId });
      await db.rules.where('categoryId').equals(id).modify({ categoryId: moveToId });
      await db.budgets.where('categoryId').equals(id).delete();
      await db.categories.delete(id);
    });
  }

  // ── Review ─────────────────────────────────────────────────────────────────

  /**
   * Saves the post-import review in one transaction. A chosen category is stored as the user's
   * own choice; with "remember" it also becomes a rule (limited to the Swish direction for
   * Swish, so paying and being paid by someone stay separate). A cleared suggestion goes back
   * to Needs review; untouched groups stay as they are.
   */
  async applyReviewDecisions(
    decisions: readonly ReviewDecision[],
    context: { now: string; newId: () => string },
  ): Promise<{ categorized: number; rulesSaved: number }> {
    const { db } = this;
    return db.transaction('rw', db.transactions, db.rules, db.categories, async () => {
      let categorized = 0;
      let rulesSaved = 0;
      for (const d of decisions) {
        if (d.categoryId === null) {
          await db.transactions
            .where('id')
            .anyOf(d.transactionIds)
            .filter((t) => t.suggested)
            .modify({ categoryId: null, categorySource: 'none', suggested: false });
          continue;
        }
        if (!(await db.categories.get(d.categoryId))) throw new Error(`Unknown category: ${d.categoryId}`);
        categorized += await db.transactions
          .where('id')
          .anyOf(d.transactionIds)
          .modify({ categoryId: d.categoryId, categorySource: 'manual', suggested: false });
        if (d.remember) {
          await this.saveUserRule(merchantRule(d.merchantKey, d.kind, d.categoryId), context);
          rulesSaved++;
        }
      }
      return { categorized, rulesSaved };
    });
  }

  /**
   * "This and future ones from <merchant>" (docs/SPEC.md §7.5): sets the transaction's category,
   * saves a rule so future imports follow it, and with `includePast` also re-categorizes earlier
   * transactions from the same merchant. Transactions the person categorized by hand are never
   * touched. Returns how many transactions changed (including this one).
   */
  async applyCategoryToMerchant(
    transactionId: string,
    categoryId: string,
    options: { includePast: boolean },
    context: { now: string; newId: () => string },
  ): Promise<number> {
    const { db } = this;
    return db.transaction('rw', db.transactions, db.rules, db.categories, async () => {
      const t = await db.transactions.get(transactionId);
      if (!t) throw new Error(`Unknown transaction: ${transactionId}`);
      if (!(await db.categories.get(categoryId))) throw new Error(`Unknown category: ${categoryId}`);

      const rule = merchantRule(t.merchantKey, t.kind, categoryId);
      await this.saveUserRule(rule, context);

      const change = { categoryId, categorySource: 'user_rule' as const, suggested: false };
      await db.transactions.update(t.id, change);
      if (!options.includePast) return 1;
      const others = await db.transactions
        .where('merchantKey')
        .equals(t.merchantKey)
        .filter((o) => o.id !== t.id && o.categorySource !== 'manual' && (!rule.kind || o.kind === rule.kind))
        .modify(change);
      return 1 + others;
    });
  }

  // ── User rules ─────────────────────────────────────────────────────────────

  listUserRules(): Promise<Rule[]> {
    return this.db.rules.toArray();
  }

  /**
   * Saves a user rule ("always categorize X as Y"). A rule with the same match (op, value and
   * kind) is updated rather than duplicated.
   */
  async saveUserRule(
    input: { op: MatchOp; value: string; kind?: Rule['kind']; categoryId: string },
    context: { now: string; newId: () => string },
  ): Promise<Rule> {
    const { db } = this;
    return db.transaction('rw', db.rules, db.categories, async () => {
      const value = input.value.trim().replace(/\s+/g, ' ').toLocaleUpperCase('sv-SE');
      if (!value) throw new Error('Rule value is required');
      if (!(await db.categories.get(input.categoryId))) throw new Error(`Unknown category: ${input.categoryId}`);

      const existing = (await db.rules.toArray()).find(
        (r) => r.op === input.op && r.value === value && r.kind === input.kind,
      );
      const rule: Rule = {
        id: existing?.id ?? context.newId(),
        source: 'user',
        op: input.op,
        value,
        ...(input.kind ? { kind: input.kind } : {}),
        categoryId: input.categoryId,
        createdAt: context.now,
      };
      await db.rules.put(rule);
      return rule;
    });
  }

  async deleteUserRule(id: string): Promise<void> {
    await this.db.rules.delete(id);
  }

  // ── Budgets ────────────────────────────────────────────────────────────────

  listBudgets(): Promise<Budget[]> {
    return this.db.budgets.toArray();
  }

  /**
   * Sets a monthly limit (null removes it) for a spending category, or the overall limit when
   * `categoryId` is null, from `fromPeriod` on. Earlier periods keep their limits.
   */
  async setBudgetLimit(
    categoryId: string | null,
    amount: Ore | null,
    fromPeriod: PeriodLabel,
    newId: () => string,
  ): Promise<void> {
    const { db } = this;
    await db.transaction('rw', db.budgets, db.categories, async () => {
      if (categoryId !== null) {
        const category = await db.categories.get(categoryId);
        if (!category) throw new Error(`Unknown category: ${categoryId}`);
        if (category.type !== 'spending') throw new Error(`"${category.name}" is not a spending category`);
      }
      const updated = setLimit(await db.budgets.toArray(), categoryId, amount, fromPeriod, newId);
      const record = updated.find((b) => b.categoryId === categoryId && b.effectiveFrom === fromPeriod)!;
      await db.budgets.put(record);
    });
  }

  // ── Settings ───────────────────────────────────────────────────────────────

  /** Updates period settings. Periods are derived, so nothing else needs to change. */
  async savePeriodSettings(changes: Partial<PeriodSettings>): Promise<AppSettings> {
    const { db } = this;
    return db.transaction('rw', db.settings, async () => {
      const next: AppSettings = { ...(await this.getSettings()), ...changes };
      payday(2026, 1, next); // validates startDay (throws RangeError if invalid)
      await db.settings.put({ key: 'app', ...next });
      return next;
    });
  }

  // ── Backup ─────────────────────────────────────────────────────────────────

  /** Everything the user has, as a backup object (see core/backup.ts for the file format). */
  async exportBackup(exportedAt: string): Promise<Backup> {
    const { db } = this;
    return db.transaction('r', db.tables, async () =>
      createBackup(
        {
          accounts: await db.accounts.toArray(),
          importBatches: await db.importBatches.toArray(),
          transactions: await db.transactions.toArray(),
          categories: await db.categories.toArray(),
          rules: await db.rules.toArray(),
          budgets: await db.budgets.toArray(),
          csvMappings: await db.csvMappings.toArray(),
          settings: await this.getSettings(),
        },
        exportedAt,
      ),
    );
  }

  /**
   * Replaces all data with a backup (validate it with `parseBackup` first). Runs in one
   * transaction: if anything fails, the existing data is left untouched.
   */
  async restoreBackup(backup: Backup): Promise<void> {
    const { db } = this;
    const { data } = backup;
    await db.transaction('rw', db.tables, async () => {
      await Promise.all(db.tables.map((t) => t.clear()));
      await db.accounts.bulkAdd(data.accounts);
      await db.importBatches.bulkAdd(data.importBatches);
      await db.transactions.bulkAdd(data.transactions);
      await db.categories.bulkAdd(data.categories);
      await db.rules.bulkAdd(data.rules);
      await db.budgets.bulkAdd(data.budgets);
      await db.csvMappings.bulkAdd(data.csvMappings);
      await db.settings.add({ key: 'app', ...data.settings, schemaVersion: SCHEMA_VERSION });
    });
  }

  /** Deletes all data and puts the defaults back, as on a fresh install. */
  async wipeAll(): Promise<void> {
    const { db } = this;
    await db.transaction('rw', db.tables, async () => {
      await Promise.all(db.tables.map((t) => t.clear()));
      await db.categories.bulkAdd([...DEFAULT_CATEGORIES]);
      await db.settings.add({ key: 'app', ...DEFAULT_SETTINGS });
    });
  }

  private async validName(name: string, ownId?: string): Promise<string> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Category name is required');
    const lower = trimmed.toLocaleLowerCase('sv-SE');
    const clash = (await this.db.categories.toArray()).find(
      (c) => c.id !== ownId && c.name.toLocaleLowerCase('sv-SE') === lower,
    );
    if (clash) throw new Error(`A category named "${clash.name}" already exists`);
    return trimmed;
  }
}

function validColor(color: string): string {
  const normalized = color.trim().toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(normalized)) throw new Error(`Invalid color: "${color}" (expected #rrggbb)`);
  return normalized;
}

/** Opens (and on first use creates and seeds) the Spendio database. */
export async function openStore(name: string = DEFAULT_DB_NAME): Promise<SpendioStore> {
  const db = new SpendioDB(name);
  await db.open();
  return new SpendioStore(db);
}

const SWISH_KINDS: ReadonlySet<TransactionKind> = new Set(['swish_out', 'swish_in', 'swish_refund']);

/**
 * The rule that remembers a merchant's category. For Swish it is limited to the direction
 * (paying someone and being paid by them are different things); otherwise it matches any kind.
 */
function merchantRule(merchantKey: string, kind: TransactionKind, categoryId: string) {
  return { op: 'equals' as const, value: merchantKey, ...(SWISH_KINDS.has(kind) ? { kind } : {}), categoryId };
}
