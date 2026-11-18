import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { backupFileName, BackupError, createBackup, parseBackup, serializeBackup, type BackupData } from './backup.ts';
import { CATEGORY_IDS as C, DEFAULT_CATEGORIES } from './categories.ts';
import { importCsv } from './import.ts';
import { DEFAULT_SETTINGS, SCHEMA_VERSION } from './settings.ts';

// These tests deliberately corrupt raw backup JSON, which has no useful static type.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = Record<string, any>;

const fixture = readFileSync(join(import.meta.dirname, '../../fixtures/nordea-sample.csv'), 'utf8');

function sampleData(): BackupData {
  let seq = 0;
  const { account, batch, transactions } = importCsv(fixture, {
    existingFingerprints: new Set(),
    now: '2026-12-29T10:00:00.000Z',
    newId: () => `id-${++seq}`,
  });
  return {
    accounts: [account],
    importBatches: [batch],
    transactions,
    categories: [...DEFAULT_CATEGORIES],
    rules: [{ id: 'r1', source: 'user', op: 'equals', value: 'TEBEX.ORG', categoryId: C.gaming, createdAt: '2026-12-01T00:00:00.000Z' }],
    budgets: [{ id: 'b1', categoryId: C.gaming, amount: 100000, effectiveFrom: '2026-12' }],
    csvMappings: [],
    settings: DEFAULT_SETTINGS,
  };
}

/** Serializes a sample backup after letting a test break it. */
function backupText(mutate: (json: Loose) => void = () => {}): string {
  const json = JSON.parse(serializeBackup(createBackup(sampleData(), '2026-12-29T12:00:00.000Z')));
  mutate(json);
  return JSON.stringify(json);
}

describe('backup round trip', () => {
  it('parses exactly what it serialized', () => {
    const backup = createBackup(sampleData(), '2026-12-29T12:00:00.000Z');
    expect(parseBackup(serializeBackup(backup))).toEqual(backup);
    expect(backup).toMatchObject({ app: 'spendio', schemaVersion: SCHEMA_VERSION });
  });

  it('names the file by export date', () => {
    expect(backupFileName('2026-11-18T09:30:00.000Z')).toBe('spendio-backup-2026-11-18.json');
  });
});

describe('parseBackup rejects', () => {
  it.each<[string, string | ((j: Loose) => void), RegExp]>([
    ['non-JSON', 'not json', /not valid JSON/],
    ['another app', JSON.stringify({ app: 'other' }), /not a Spendio backup/],
    ['a newer schema', (j) => (j.schemaVersion = SCHEMA_VERSION + 1), /newer version/],
    ['a missing list', (j) => delete j.data.rules, /data\.rules must be a list/],
    ['duplicate ids', (j) => j.data.transactions.push(j.data.transactions[0]), /duplicate id/],
    ['a missing system category', (j) => (j.data.categories = j.data.categories.filter((c: Loose) => c.id !== 'income')), /system category "income"/],
    ['an unknown category on a transaction', (j) => (j.data.transactions[0].categoryId = 'nope'), /unknown category/],
    ['an unknown import batch', (j) => (j.data.transactions[0].importBatchId = 'nope'), /unknown import batch/],
    ['a float amount', (j) => (j.data.transactions[0].amount = 12.5), /invalid amounts/],
    ['a bad date', (j) => (j.data.transactions[0].effectiveDate = '2026/12/01'), /invalid dates/],
    ['a bad rule op', (j) => (j.data.rules[0].op = 'regex'), /rule r1 is malformed/],
    ['a negative budget', (j) => (j.data.budgets[0].amount = -1), /invalid amount/],
    ['a bad budget period', (j) => (j.data.budgets[0].effectiveFrom = '2026-13'), /invalid period/],
    ['a bad start day', (j) => (j.data.settings.startDay = 31), /startDay must be 1–28/],
  ])('%s', (_, input, message) => {
    const text = typeof input === 'string' ? input : backupText(input);
    expect(() => parseBackup(text)).toThrow(BackupError);
    expect(() => parseBackup(text)).toThrow(message);
  });
});

describe('parseBackup privacy', () => {
  it('scrubs personnummer from descriptions in a hand-edited file', () => {
    const text = backupText((j) => (j.data.transactions[0].description = 'Swish 121212-1212'));
    expect(parseBackup(text).data.transactions[0]!.description).toBe('Swish [redacted]');
  });
});
