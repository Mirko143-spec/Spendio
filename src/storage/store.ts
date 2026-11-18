import type { Account } from '../core/account.ts';
import type { Category } from '../core/categories.ts';
import { DEFAULT_SETTINGS, type AppSettings } from '../core/settings.ts';
import { DEFAULT_DB_NAME, SpendioDB } from './db.ts';

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
}

/** Opens (and on first use creates and seeds) the Spendio database. */
export async function openStore(name: string = DEFAULT_DB_NAME): Promise<SpendioStore> {
  const db = new SpendioDB(name);
  await db.open();
  return new SpendioStore(db);
}
