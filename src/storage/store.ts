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
}

/** Opens (and on first use creates and seeds) the Spendio database. */
export async function openStore(name: string = DEFAULT_DB_NAME): Promise<SpendioStore> {
  const db = new SpendioDB(name);
  await db.open();
  return new SpendioStore(db);
}
