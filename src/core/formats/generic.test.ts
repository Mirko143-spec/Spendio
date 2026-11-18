import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATEGORY_IDS as C } from '../categories.ts';
import type { CsvMapping } from '../csv/mapping.ts';
import { importCsv } from '../import.ts';
import { BANK_FORMATS } from './index.ts';
import { describeGeneric, formatFromMapping } from './generic.ts';

const fixture = readFileSync(join(import.meta.dirname, '../../../fixtures/generic-sample.csv'), 'utf8');
const TESTBANK: CsvMapping = {
  id: 'm1',
  headerSignature: 'date,description,reference,debit,credit,balance',
  name: 'Testbank',
  delimiter: ',',
  dateFormat: 'DD/MM/YYYY',
  decimal: '.',
  columns: { date: 0, description: [1], debit: 3, credit: 4, balance: 5 },
  createdAt: '2026-11-18T00:00:00.000Z',
};

describe('describeGeneric', () => {
  it('strips leading dates and references so the merchant name comes first', () => {
    expect(describeGeneric('261025 SPOTIFY P1234ABCD5', '2026-10-26')).toEqual({
      kind: 'other',
      counterparty: 'SPOTIFY P1234ABCD5',
      purchaseDate: '2026-10-25',
      effectiveDate: '2026-10-25',
    });
    expect(describeGeneric('2026-11-02 12.11 ICA NARA', '2026-11-03').counterparty).toBe('ICA NARA');
  });

  it('ignores an implausible leading date but still strips it', () => {
    expect(describeGeneric('990101 SPOTIFY', '2026-10-26')).toEqual({
      kind: 'other',
      counterparty: 'SPOTIFY',
      effectiveDate: '2026-10-26',
    });
  });

  it('keeps names that only look like numbers', () => {
    expect(describeGeneric('7-ELEVEN', '2026-10-26').counterparty).toBe('7-ELEVEN');
    expect(describeGeneric('1177', '2026-10-26').counterparty).toBe('1177');
  });
});

describe('formatFromMapping', () => {
  const format = formatFromMapping(TESTBANK);

  it('is a bank format named after the bank, for its layout only', () => {
    expect(format).toMatchObject({ id: 'csv:m1', name: 'Testbank', country: 'SE' });
    expect(format.detect(fixture)).toBe(true);
    expect(format.detect('Bokföringsdag;Belopp;Avsändare;Mottagare;Namn;Rubrik;Saldo;Valuta;\n')).toBe(false);
  });

  it('imports the fixture end to end, categorized by the country’s rules', () => {
    let seq = 0;
    const result = importCsv(fixture, {
      existingFingerprints: new Set(),
      now: '2026-11-18T10:00:00.000Z',
      newId: () => `id-${++seq}`,
      formats: [...BANK_FORMATS, format],
    });
    expect(result.format).toEqual({ id: 'csv:m1', name: 'Testbank', country: 'SE' });
    expect(result.account).toEqual({ id: 'account:csv:m1', bank: 'csv:m1', name: 'Testbank' });
    expect(result.batch).toMatchObject({ label: 'Testbank · 2026-11-18', newCount: 9, errorCount: 0 });
    expect(Object.fromEntries(result.transactions.map((t) => [t.merchantDisplay, t.categoryId]))).toEqual({
      'ICA NARA TESTBY': C.groceries,
      'LÖN TESTBOLAGET AB': C.income,
      'Restaurang Exempel, Stockholm': C.restaurants,
      SPOTIFY: C.subscriptions,
      'Swish ANNA TESTSSON': null,
      'HYRA EXEMPELBOSTÄDER AB': null,
      'STEAM PURCHASE': C.gaming,
      'COOP EXEMPELSTAD': C.groceries,
    });
  });
});
