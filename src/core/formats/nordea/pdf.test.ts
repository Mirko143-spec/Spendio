import { describe, expect, it } from 'vitest';
import { importCsv } from '../../import.ts';
import { detectFormat } from '../index.ts';
import { NORDEA_PDF } from './pdf.ts';

// What core/pdf/table.ts makes of an (invented) Nordea PDF transaction list.
const table = [
  'Datum;Namn;Belopp;Saldo',
  '2026-11-18;Kortköp 261117 WILLYS EXEMPEL;-412,50;2 087,50',
  '2026-11-17;Swish inbetalning EVA PROV;150,00;2 500,00',
  '2026-11-16;Insättning 1234 56 78901;2 350,00;2 350,00',
].join('\n');

// The same first two transactions as a Nordea CSV export.
const csv = [
  '﻿Bokföringsdag;Belopp;Avsändare;Mottagare;Namn;Rubrik;Saldo;Valuta;',
  '2026/11/18;-412,50;000000-0000;;;Kortköp 261117 WILLYS EXEMPEL;2087,50;SEK;',
  '2026/11/17;150,00;;000000-0000;;Swish inbetalning EVA PROV;2500,00;SEK;',
].join('\n');

const ctx = { now: '2026-11-19T00:00:00.000Z', newId: () => crypto.randomUUID() };

describe('NORDEA_PDF', () => {
  it('is detected from the table header', () => {
    expect(detectFormat(table)).toBe(NORDEA_PDF);
    expect(detectFormat('Datum;Text;Belopp;Saldo\n2026-11-18;x;1,00;1,00')).toBeUndefined();
  });

  it('reads dates, amounts with thousands spaces, balances and Nordea descriptions', () => {
    const { transactions, batch } = importCsv(table, { ...ctx, existingFingerprints: new Set() });
    expect(batch.errorCount).toBe(0);
    expect(transactions.map((t) => [t.bookingDate, t.amount, t.balance, t.kind, t.merchantDisplay])).toEqual([
      ['2026-11-18', -41250, 208750, 'card', 'WILLYS EXEMPEL'],
      ['2026-11-17', 15000, 250000, 'swish_in', 'EVA PROV'],
      ['2026-11-16', 235000, 235000, 'deposit', 'Insättning'],
    ]);
    expect(transactions[0]).toMatchObject({ accountId: 'account:nordea', purchaseDate: '2026-11-17', categoryId: 'groceries' });
  });

  it('is the same account as the CSV export, so overlapping files are not imported twice', () => {
    const fromCsv = importCsv(csv, { ...ctx, existingFingerprints: new Set() });
    const fromPdf = importCsv(table, { ...ctx, existingFingerprints: new Set(fromCsv.transactions.map((t) => t.fingerprint)) });
    expect(fromPdf.batch).toMatchObject({ newCount: 1, duplicateCount: 2 });
  });
});
