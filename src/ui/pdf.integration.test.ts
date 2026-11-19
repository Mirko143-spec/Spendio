import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { importCsv } from '../core/import.ts';
import { readPdfPages, statementText, type PdfJs } from './pdf.ts';

// The real pdf.js (its Node build) on the invented Nordea-layout PDF (fixtures/make-nordea-pdf.mjs).
const pdf = new Uint8Array(readFileSync(join(import.meta.dirname, '../../fixtures/nordea-pdf-sample.pdf')));
const loadPdfJs = async () => (await import('pdfjs-dist/legacy/build/pdf.mjs')) as unknown as PdfJs;

describe('PDF statements, end to end', () => {
  it('imports every booked transaction, and nothing else on the pages', async () => {
    const text = statementText(await readPdfPages(await loadPdfJs(), pdf));
    const { transactions, batch } = importCsv(text, { existingFingerprints: new Set(), now: '2026-11-19T00:00:00.000Z', newId: () => crypto.randomUUID() });

    expect(batch).toMatchObject({ label: 'Nordea · 2026-11-19', rowCount: 8, newCount: 8, errorCount: 0 });
    expect(transactions.map((t) => [t.bookingDate, t.amount, t.balance, t.merchantDisplay, t.categoryId])).toEqual([
      ['2026-11-18', -41250, 961840, 'WILLYS EXEMPELGATAN', 'groceries'],
      ['2026-11-17', 15000, 1003090, 'EVA PROV', 'swish-from-people'],
      ['2026-11-14', -745000, 988090, 'Exempelbostäder AB', null],
      ['2026-11-12', -6200, 1733090, 'ESPRESSO HOUSE', 'restaurants'],
      ['2026-11-10', -30000, 1739290, 'OLLE TEST', 'swish-people'],
      ['2026-11-05', -106000, 1769290, 'SL APP', 'transport'],
      ['2026-10-27', -200000, 1875290, 'Vattenfall', 'housing'],
      ['2026-10-23', 1950000, 2075290, 'LÖN Exempelbolaget AB', 'income'],
    ]);
    // The account summary above the table (name, account number) never reaches the import.
    expect(text).not.toMatch(/PRIVATKONTO|000000-0000|Skapad av|saldo:/);
  });
});
