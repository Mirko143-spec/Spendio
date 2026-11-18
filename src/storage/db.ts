import Dexie, { type EntityTable } from 'dexie';
import type { Account } from '../core/account.ts';
import type { Budget } from '../core/budgets.ts';
import { CATEGORY_IDS, DEFAULT_CATEGORIES, type Category } from '../core/categories.ts';
import type { CsvMapping } from '../core/csv/mapping.ts';
import type { ImportBatch, Transaction } from '../core/import.ts';
import type { Rule } from '../core/rules.ts';
import { DEFAULT_SETTINGS, type AppSettings } from '../core/settings.ts';

/**
 * IndexedDB schema (docs/SPEC.md §13–14). This folder is the only code that touches browser
 * storage; passcode encryption (v1.1) will be added here without changing callers.
 */

export interface SettingsRow extends AppSettings {
  key: 'app';
}

export const DEFAULT_DB_NAME = 'spendio';

export class SpendioDB extends Dexie {
  accounts!: EntityTable<Account, 'id'>;
  importBatches!: EntityTable<ImportBatch, 'id'>;
  transactions!: EntityTable<Transaction, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  rules!: EntityTable<Rule, 'id'>;
  budgets!: EntityTable<Budget, 'id'>;
  csvMappings!: EntityTable<CsvMapping, 'id'>;
  settings!: EntityTable<SettingsRow, 'key'>;

  constructor(name: string = DEFAULT_DB_NAME) {
    super(name);
    this.version(1).stores({
      accounts: 'id',
      importBatches: 'id, accountId, importedAt',
      // Unique fingerprints are a last line of defense against double imports.
      transactions: 'id, accountId, importBatchId, &fingerprint, effectiveDate, categoryId, merchantKey',
      categories: 'id',
      rules: 'id, categoryId',
      budgets: 'id, categoryId, effectiveFrom',
      csvMappings: 'id, &headerSignature',
      settings: 'key',
    });

    // v2: databases created before "Swish from people" existed get it added. Only that category,
    // so defaults a person deleted on purpose stay deleted. (New databases get it from `populate`.)
    this.version(2)
      .stores({})
      .upgrade(async (tx) => {
        const categories = tx.table<Category, string>('categories');
        const added = DEFAULT_CATEGORIES.find((c) => c.id === CATEGORY_IDS.swishFromPeople)!;
        if (!(await categories.get(added.id))) await categories.add(added);
      });

    // Runs once, when the database is first created. Accounts are created by the first import.
    this.on('populate', (tx) => {
      void tx.table('categories').bulkAdd([...DEFAULT_CATEGORIES]);
      void tx.table('settings').add({ key: 'app', ...DEFAULT_SETTINGS } satisfies SettingsRow);
    });
  }
}
