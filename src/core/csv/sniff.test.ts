import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { guessMapping, sniffCsv } from './sniff.ts';

const fixture = (name: string) => readFileSync(join(import.meta.dirname, '../../../fixtures', name), 'utf8');

describe('sniffCsv', () => {
  it('reads a comma file with quoted fields', () => {
    const s = sniffCsv(fixture('generic-sample.csv'));
    expect(s.delimiter).toBe(',');
    expect(s.header).toEqual(['Date', 'Description', 'Reference', 'Debit', 'Credit', 'Balance']);
    expect(s.rows).toHaveLength(9);
    expect(s.rows[2]).toEqual(['24/10/2026', 'Restaurang Exempel, Stockholm', 'REF1003', '245.00', '', '27,942.60']);
    expect(s.signature).toBe('date,description,reference,debit,credit,balance');
  });

  it('reads a semicolon file with a BOM and trailing delimiters (Nordea)', () => {
    const s = sniffCsv(fixture('nordea-sample.csv'));
    expect(s.delimiter).toBe(';');
    expect(s.header[0]).toBe('Bokföringsdag');
    expect(s.rows).toHaveLength(28);
  });

  it('reads tab-separated files and pads short rows', () => {
    const s = sniffCsv('Datum\tText\tBelopp\n2026-11-01\tICA\t-12,50\n2026-11-02\tSL\n');
    expect(s.delimiter).toBe('\t');
    expect(s.rows).toEqual([
      ['2026-11-01', 'ICA', '-12,50'],
      ['2026-11-02', 'SL', ''],
    ]);
  });
});

describe('guessMapping', () => {
  it('guesses debit/credit, balance, day-first dates and dot decimals', () => {
    expect(guessMapping(sniffCsv(fixture('generic-sample.csv')))).toEqual({
      dateFormat: 'DD/MM/YYYY',
      decimal: '.',
      columns: { date: 0, debit: 3, credit: 4, balance: 5, description: [1] },
    });
  });

  it('guesses a single signed amount, comma decimals and the description column (Nordea layout)', () => {
    expect(guessMapping(sniffCsv(fixture('nordea-sample.csv')))).toEqual({
      dateFormat: 'YYYY/MM/DD',
      decimal: ',',
      columns: { date: 0, amount: 1, balance: 6, description: [5] },
    });
  });

  it('works from the values alone when headers are unhelpful', () => {
    const s = sniffCsv('a;b;c;d\n2026-11-01;ICA NARA;-312,40;1 000,00\n2026-11-03;SPOTIFY;-129,00;871,00\n');
    expect(guessMapping(s)).toEqual({
      dateFormat: 'YYYY-MM-DD',
      decimal: ',',
      columns: { date: 0, amount: 2, balance: 3, description: [1] },
    });
  });

  it('reads ambiguous dates day-first, but month-first when a day is over 12', () => {
    const dayFirst = sniffCsv('Date,Text,Amount\n03/11/2026,A,-1.00\n05/11/2026,B,-2.00\n');
    expect(guessMapping(dayFirst).dateFormat).toBe('DD/MM/YYYY');
    const monthFirst = sniffCsv('Date,Text,Amount\n11/03/2026,A,-1.00\n11/25/2026,B,-2.00\n');
    expect(guessMapping(monthFirst).dateFormat).toBe('MM/DD/YYYY');
  });

  it('leaves out what it cannot find', () => {
    const g = guessMapping(sniffCsv('Name,Note\nAnna,hello\nBo,hi\n'));
    expect(g.columns.date).toBeUndefined();
    expect(g.columns.amount).toBeUndefined();
  });
});

describe('guessMapping and ID numbers', () => {
  it('never suggests a column of personnummer as the description', () => {
    // Test identity 121212-1212 (Skatteverket's "Tolvan"), not a real person.
    const s = sniffCsv('Datum;Avsändare;Belopp\n2026-11-01;121212-1212;-12,00\n2026-11-02;121212-1212;-13,00\n');
    expect(guessMapping(s).columns.description).toBeUndefined();
  });
});
