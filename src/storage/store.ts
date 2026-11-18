import { DEFAULT_ACCOUNT, type Account } from '../core/account.ts';
import type { Category } from '../core/categories.ts';
import { importNordeaCsv, type ImportBatch, type ImportResult, type Transaction } from '../core/import.ts';
import { DEFAULT_SETTINGS, type AppSettings } from '../core/settings.ts';
import { DEFAULT_DB_NAME, SpendioDB } from './db.ts';

export interface ImportContext {
  /** ISO timestamp of the import. */
  now: string;
  newId: () => string;
  accountId?: string;
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

  listCategories(): Promise<Category[]> {
    return this.db.categories.toArray();
  }

  async getSettings(): Promise<AppSettings> {
    const row = await this.db.settings.get('app');
    if (!row) return { ...DEFAULT_SETTINGS };
    return { startDay: row.startDay, adjustToBankingDay: row.adjustToBankingDay, schemaVersion: row.schemaVersion };
  }

  // ── Imports ────────────────────────────────────────────────────────────────

  /**
   * Imports a Nordea CSV: reads existing fingerprints and user rules, runs the pure import
   * pipeline and saves the result, all in one IndexedDB transaction. Either everything is
   * saved or nothing is. A batch with no new rows is reported but not stored.
   */
  importNordea(text: string, context: ImportContext): Promise<ImportResult> {
    const { db } = this;
    return db.transaction('rw', db.transactions, db.importBatches, db.rules, async () => {
      const existingFingerprints = new Set(await db.transactions.orderBy('fingerprint').keys()) as Set<string>;
      const userRules = await db.rules.toArray();
      const result = importNordeaCsv(text, {
        accountId: context.accountId ?? DEFAULT_ACCOUNT.id,
        existingFingerprints,
        userRules,
        now: context.now,
        newId: context.newId,
      });
      if (result.transactions.length > 0) {
        await db.importBatches.add(result.batch);
        await db.transactions.bulkAdd(result.transactions);
      }
      return result;
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

  // ── Transactions ───────────────────────────────────────────────────────────

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
