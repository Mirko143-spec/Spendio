import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { matchesMapping, parseWithMapping } from './generic.ts';
import type { CsvMapping } from './mapping.ts';

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

describe('parseWithMapping on the Testbank fixture', () => {
  const { rows, errors } = parseWithMapping(fixture, TESTBANK);

  it('parses every row', () => {
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(9);
  });

  it('combines debit and credit into one signed amount, with dot decimals and thousands separators', () => {
    expect(rows.map((r) => [r.bookingDate, r.amount, r.description])).toEqual([
      ['2026-10-20', -31240, 'ICA NARA TESTBY'],
      ['2026-10-23', 1850000, 'LÖN TESTBOLAGET AB'],
      ['2026-10-24', -24500, 'Restaurang Exempel, Stockholm'],
      ['2026-10-26', -12900, '261025 SPOTIFY P1234ABCD5'],
      ['2026-10-28', -25000, 'Swish ANNA TESTSSON'],
      ['2026-11-01', -645000, 'HYRA EXEMPELBOSTÄDER AB'],
      ['2026-11-03', -19900, 'STEAM PURCHASE 4242'],
      ['2026-11-10', 12500, 'Swish ANNA TESTSSON'],
      ['2026-11-12', -123456, 'COOP EXEMPELSTAD'],
    ]);
    expect(rows[8]!.balance).toBe(1980504);
  });

  it('recognizes its layout by the header row', () => {
    expect(matchesMapping(fixture, TESTBANK)).toBe(true);
    expect(matchesMapping('Date,Text,Amount\n', TESTBANK)).toBe(false);
  });
});

describe('parseWithMapping details', () => {
  const mapping = (changes: Partial<CsvMapping>): CsvMapping => ({ ...TESTBANK, ...changes });

  it('reads a single signed amount column with comma decimals', () => {
    const text = 'Datum;Text;Belopp\n2026-11-01;ICA;-1 234,50\n2026-11-02;Lön;25 000,00\n';
    const m = mapping({ delimiter: ';', decimal: ',', dateFormat: 'YYYY-MM-DD', columns: { date: 0, description: [1], amount: 2 } });
    expect(parseWithMapping(text, m).rows.map((r) => r.amount)).toEqual([-123450, 2500000]);
  });

  it('treats debits written as negative numbers as money out too', () => {
    const text = 'Date,Text,Out,In\n01/11/2026,ICA,-12.50,\n';
    const m = mapping({ columns: { date: 0, description: [1], debit: 2, credit: 3 } });
    expect(parseWithMapping(text, m).rows[0]!.amount).toBe(-1250);
  });

  it('joins several description columns', () => {
    const text = 'Date,Payee,Message,Amount\n01/11/2026,EXEMPEL AB,Faktura 12,-10.00\n';
    const m = mapping({ columns: { date: 0, description: [1, 2], amount: 3 } });
    expect(parseWithMapping(text, m).rows[0]!.description).toBe('EXEMPEL AB Faktura 12');
  });

  it('scrubs national ID numbers from the description', () => {
    const text = 'Date,Text,Amount\n01/11/2026,Swish 121212-1212,-10.00\n';
    const m = mapping({ columns: { date: 0, description: [1], amount: 2 } });
    expect(parseWithMapping(text, m).rows[0]!.description).toBe('Swish [redacted]');
  });

  it('reports bad lines with their line numbers and keeps the rest', () => {
    const text = 'Date,Text,Amount\n01/11/2026,OK,-1.00\n2026-11-02,Bad date,-1.00\n03/11/2026,Bad amount,abc\n04/11/2026,,-1.00\n';
    const m = mapping({ columns: { date: 0, description: [1], amount: 2 } });
    const { rows, errors } = parseWithMapping(text, m);
    expect(rows.map((r) => r.description)).toEqual(['OK']);
    expect(errors).toEqual([
      { line: 3, message: 'Invalid date: "2026-11-02" (expected DD/MM/YYYY)' },
      { line: 4, message: 'Invalid amount: "abc"' },
      { line: 5, message: 'Missing description' },
    ]);
  });

  it('reports a row with neither debit nor credit', () => {
    const text = 'Date,Text,Out,In\n01/11/2026,Nothing,,\n';
    const m = mapping({ columns: { date: 0, description: [1], debit: 2, credit: 3 } });
    expect(parseWithMapping(text, m).errors).toEqual([{ line: 2, message: 'Missing amount (both debit and credit are empty)' }]);
  });
});
