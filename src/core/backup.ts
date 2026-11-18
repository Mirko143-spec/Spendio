import type { Account } from './account.ts';
import type { Budget } from './budgets.ts';
import { CATEGORY_IDS, type Category } from './categories.ts';
import { COUNTRIES } from './country/index.ts';
import { DATE_FORMATS, type CsvMapping } from './csv/mapping.ts';
import type { ImportBatch, Transaction } from './import.ts';
import type { Rule } from './rules.ts';
import { SCHEMA_VERSION, type AppSettings } from './settings.ts';

/**
 * Backup file format (docs/SPEC.md §14). v1 backups are plain JSON (not encrypted). Restoring
 * replaces all data, so `parseBackup` validates everything before anything is written.
 */

export interface BackupData {
  accounts: Account[];
  importBatches: ImportBatch[];
  transactions: Transaction[];
  categories: Category[];
  rules: Rule[];
  budgets: Budget[];
  csvMappings: CsvMapping[];
  settings: AppSettings;
}

export interface Backup {
  app: 'spendio';
  schemaVersion: number;
  exportedAt: string;
  data: BackupData;
}

export class BackupError extends Error {
  override name = 'BackupError';
}

export function createBackup(data: BackupData, exportedAt: string): Backup {
  return { app: 'spendio', schemaVersion: SCHEMA_VERSION, exportedAt, data };
}

export function serializeBackup(backup: Backup): string {
  return JSON.stringify(backup, null, 2);
}

/** `spendio-backup-2026-11-18.json` */
export function backupFileName(exportedAt: string): string {
  return `spendio-backup-${exportedAt.slice(0, 10)}.json`;
}

// ── Validation ───────────────────────────────────────────────────────────────

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isInt = (v: unknown): v is number => Number.isSafeInteger(v);
const isDate = (v: unknown): v is string => isStr(v) && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isPeriod = (v: unknown): v is string => isStr(v) && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

function fail(message: string): never {
  throw new BackupError(message);
}

function check(condition: boolean, where: string, what: string): void {
  if (!condition) fail(`Invalid backup: ${where} ${what}`);
}

function list(data: Obj, key: keyof BackupData): Obj[] {
  const value = data[key];
  check(Array.isArray(value), `data.${key}`, 'must be a list');
  (value as unknown[]).forEach((item, i) => check(isObj(item), `data.${key}[${i}]`, 'must be an object'));
  return value as Obj[];
}

function unique(items: Obj[], key: string, where: string): Set<string> {
  const seen = new Set<string>();
  for (const item of items) {
    const value = item[key];
    check(isStr(value) && value.length > 0, where, `has a missing ${key}`);
    check(!seen.has(value as string), where, `has a duplicate ${key}: ${String(value)}`);
    seen.add(value as string);
  }
  return seen;
}

const KINDS = new Set(['card', 'swish_out', 'swish_in', 'swish_refund', 'autogiro', 'deposit', 'other']);
const SOURCES = new Set(['manual', 'user_rule', 'builtin_rule', 'kind_default', 'none']);
const OPS = new Set(['equals', 'startsWith', 'contains']);

/**
 * Parses and validates a backup file. Throws `BackupError` with a readable message if
 * anything is malformed, from a newer app version, or internally inconsistent.
 * Descriptions are scrubbed of national ID numbers (every supported country's format) again,
 * in case the file was edited by hand.
 */
function redactPersonalIds(text: string): string {
  return Object.values(COUNTRIES).reduce((acc, country) => country.redactPersonalIds(acc), text);
}

export function parseBackup(text: string): Backup {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    fail('This file is not a Spendio backup (not valid JSON).');
  }
  if (!isObj(json) || json.app !== 'spendio') fail('This file is not a Spendio backup.');
  check(isInt(json.schemaVersion) && (json.schemaVersion as number) >= 1, 'schemaVersion', 'must be a positive integer');
  if ((json.schemaVersion as number) > SCHEMA_VERSION) {
    fail('This backup was made by a newer version of Spendio. Update the app and try again.');
  }
  check(isStr(json.exportedAt), 'exportedAt', 'must be a timestamp');
  check(isObj(json.data), 'data', 'must be an object');
  const data = json.data as Obj;

  const accounts = list(data, 'accounts');
  const accountIds = unique(accounts, 'id', 'data.accounts');
  for (const a of accounts) check(isStr(a.name) && isStr(a.bank) && a.bank.length > 0, `account ${String(a.id)}`, 'is malformed');

  const categories = list(data, 'categories');
  const categoryIds = unique(categories, 'id', 'data.categories');
  for (const c of categories) {
    check(isStr(c.name) && isStr(c.color) && /^#[0-9a-f]{6}$/.test(c.color as string), `category ${String(c.id)}`, 'is malformed');
    check(['spending', 'income', 'transfer'].includes(c.type as string) && typeof c.system === 'boolean', `category ${String(c.id)}`, 'is malformed');
  }
  for (const id of [CATEGORY_IDS.income, CATEGORY_IDS.savings, CATEGORY_IDS.internal]) {
    check(categoryIds.has(id), 'data.categories', `is missing the system category "${id}"`);
  }

  const batches = list(data, 'importBatches');
  const batchIds = unique(batches, 'id', 'data.importBatches');
  for (const b of batches) {
    check(accountIds.has(b.accountId as string) && isStr(b.label) && isStr(b.importedAt), `import batch ${String(b.id)}`, 'is malformed');
    for (const n of ['rowCount', 'newCount', 'duplicateCount', 'errorCount']) check(isInt(b[n]), `import batch ${String(b.id)}`, `has an invalid ${n}`);
  }

  const transactions = list(data, 'transactions');
  unique(transactions, 'id', 'data.transactions');
  unique(transactions, 'fingerprint', 'data.transactions');
  for (const t of transactions) {
    const where = `transaction ${String(t.id)}`;
    check(accountIds.has(t.accountId as string), where, 'refers to an unknown account');
    check(batchIds.has(t.importBatchId as string), where, 'refers to an unknown import batch');
    check(isDate(t.bookingDate) && isDate(t.effectiveDate), where, 'has invalid dates');
    check(t.purchaseDate === undefined || isDate(t.purchaseDate), where, 'has an invalid purchase date');
    check(isInt(t.amount) && (t.balance === undefined || isInt(t.balance)), where, 'has invalid amounts');
    check(t.currency === 'SEK' && isStr(t.description), where, 'is malformed');
    check(KINDS.has(t.kind as string) && isStr(t.merchantKey) && isStr(t.merchantDisplay), where, 'is malformed');
    check(t.categoryId === null || categoryIds.has(t.categoryId as string), where, 'refers to an unknown category');
    check(SOURCES.has(t.categorySource as string) && typeof t.suggested === 'boolean', where, 'is malformed');
    t.description = redactPersonalIds(t.description as string);
  }

  const rules = list(data, 'rules');
  unique(rules, 'id', 'data.rules');
  for (const r of rules) {
    const where = `rule ${String(r.id)}`;
    check(r.source === 'user' && OPS.has(r.op as string) && isStr(r.value) && isStr(r.createdAt), where, 'is malformed');
    check(r.kind === undefined || KINDS.has(r.kind as string), where, 'has an invalid kind');
    check(categoryIds.has(r.categoryId as string), where, 'refers to an unknown category');
  }

  const budgets = list(data, 'budgets');
  unique(budgets, 'id', 'data.budgets');
  for (const b of budgets) {
    const where = `budget ${String(b.id)}`;
    check(b.categoryId === null || categoryIds.has(b.categoryId as string), where, 'refers to an unknown category');
    check(b.amount === null || (isInt(b.amount) && (b.amount as number) >= 0), where, 'has an invalid amount');
    check(isPeriod(b.effectiveFrom), where, 'has an invalid period');
  }

  const csvMappings = list(data, 'csvMappings');
  unique(csvMappings, 'id', 'data.csvMappings');
  for (const m of csvMappings) {
    const where = `CSV mapping ${String(m.id)}`;
    check(isStr(m.headerSignature) && isStr(m.name) && isStr(m.createdAt), where, 'is malformed');
    check([',', ';', '\t', '|'].includes(m.delimiter as string), where, 'has an invalid delimiter');
    check((DATE_FORMATS as readonly string[]).includes(m.dateFormat as string), where, 'has an invalid date format');
    check(m.decimal === ',' || m.decimal === '.', where, 'has an invalid decimal separator');
    const cols = m.columns as Obj;
    const index = (v: unknown) => v === undefined || (isInt(v) && (v as number) >= 0);
    check(
      isObj(cols) &&
        isInt(cols.date) &&
        Array.isArray(cols.description) &&
        (cols.description as unknown[]).length > 0 &&
        (cols.description as unknown[]).every(index) &&
        [cols.amount, cols.debit, cols.credit, cols.balance].every(index) &&
        (cols.amount !== undefined || cols.debit !== undefined || cols.credit !== undefined),
      where,
      'has invalid columns',
    );
  }

  const s = data.settings;
  check(isObj(s), 'data.settings', 'must be an object');
  const settings = s as Obj;
  check(isInt(settings.startDay) && (settings.startDay as number) >= 1 && (settings.startDay as number) <= 28, 'settings.startDay', 'must be 1–28');
  check(typeof settings.adjustToBankingDay === 'boolean', 'settings.adjustToBankingDay', 'must be true or false');

  return {
    app: 'spendio',
    schemaVersion: json.schemaVersion as number,
    exportedAt: json.exportedAt as string,
    data: {
      accounts: accounts as unknown as Account[],
      importBatches: batches as unknown as ImportBatch[],
      transactions: transactions as unknown as Transaction[],
      categories: categories as unknown as Category[],
      rules: rules as unknown as Rule[],
      budgets: budgets as unknown as Budget[],
      csvMappings: csvMappings as unknown as CsvMapping[],
      settings: {
        startDay: settings.startDay as number,
        adjustToBankingDay: settings.adjustToBankingDay as boolean,
        schemaVersion: SCHEMA_VERSION,
      },
    },
  };
}
