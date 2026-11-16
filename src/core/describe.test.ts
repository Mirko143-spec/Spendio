import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseNordeaCsv } from './csv/nordea.ts';
import { describeTransaction } from './describe.ts';

describe('describeTransaction', () => {
  it.each([
    ['Kortköp 261114 Spotify P4938CFA38', '2026-11-15', { kind: 'card', counterparty: 'Spotify P4938CFA38', purchaseDate: '2026-11-14', effectiveDate: '2026-11-14' }],
    ['Swish betalning EXEMPELBUTIKEN AB', '2026-10-28', { kind: 'swish_out', counterparty: 'EXEMPELBUTIKEN AB', effectiveDate: '2026-10-28' }],
    ['Swish inbetalning DOE,JOHN', '2026-11-12', { kind: 'swish_in', counterparty: 'DOE,JOHN', effectiveDate: '2026-11-12' }],
    ['Swish återbetalning STIFTELSEN EXEMPELHUSET', '2026-11-12', { kind: 'swish_refund', counterparty: 'STIFTELSEN EXEMPELHUSET', effectiveDate: '2026-11-12' }],
    ['Autogiro Lysa Spar', '2026-10-23', { kind: 'autogiro', counterparty: 'Lysa Spar', effectiveDate: '2026-10-23' }],
    ['Insättningsautomat', '2026-11-20', { kind: 'deposit', counterparty: 'Insättningsautomat', effectiveDate: '2026-11-20' }],
    ['Insättning 4238 13 04548', '2026-11-16', { kind: 'deposit', counterparty: 'Insättning', effectiveDate: '2026-11-16' }],
    ['LYSA', '2026-11-10', { kind: 'other', counterparty: 'LYSA', effectiveDate: '2026-11-10' }],
    ['Studiestöd', '2026-10-23', { kind: 'other', counterparty: 'Studiestöd', effectiveDate: '2026-10-23' }],
  ])('%s', (description, bookingDate, expected) => {
    expect(describeTransaction(description, bookingDate)).toEqual(expected);
  });

  it('uses the purchase date when a card purchase is booked in the next period', () => {
    // Bought on payday eve (Nov 24), booked on payday (Nov 25): belongs to the earlier period.
    expect(describeTransaction('Kortköp 261124 PARKSTER SWE', '2026-11-25')).toMatchObject({
      purchaseDate: '2026-11-24',
      effectiveDate: '2026-11-24',
    });
  });

  it('handles a purchase on Dec 31 booked in the new year', () => {
    expect(describeTransaction('Kortköp 261231 SJ.SE', '2027-01-02').effectiveDate).toBe('2026-12-31');
  });

  it.each([
    ['after the booking date', 'Kortköp 261120 X', '2026-11-15'],
    ['more than 30 days before booking', 'Kortköp 260901 X', '2026-11-15'],
    ['not a real date', 'Kortköp 261332 X', '2026-11-15'],
  ])('falls back to the booking date when the purchase date is %s', (_, description, bookingDate) => {
    const result = describeTransaction(description, bookingDate);
    expect(result).not.toHaveProperty('purchaseDate');
    expect(result.effectiveDate).toBe(bookingDate);
    expect(result.kind).toBe('card');
  });

  it('accepts card purchases without a date and prefixes without diacritics', () => {
    expect(describeTransaction('Kortköp ICA NARA', '2026-11-01')).toMatchObject({ kind: 'card', counterparty: 'ICA NARA' });
    expect(describeTransaction('Kortkop 261031 SJ.SE', '2026-11-01')).toMatchObject({ kind: 'card', purchaseDate: '2026-10-31' });
    expect(describeTransaction('Swish aterbetalning X', '2026-11-01').kind).toBe('swish_refund');
  });

  it('does not mistake words that merely start like a prefix', () => {
    expect(describeTransaction('Insättningar sammanställning', '2026-11-01').kind).toBe('other');
    expect(describeTransaction('Swishkonto avgift', '2026-11-01').kind).toBe('other');
  });
});

describe('describeTransaction on the fixture', () => {
  const fixture = readFileSync(join(import.meta.dirname, '../../fixtures/nordea-sample.csv'), 'utf8');
  const described = parseNordeaCsv(fixture).rows.map((r) => describeTransaction(r.description, r.bookingDate));

  it('classifies every row', () => {
    const counts = described.reduce<Record<string, number>>((acc, d) => ({ ...acc, [d.kind]: (acc[d.kind] ?? 0) + 1 }), {});
    expect(counts).toEqual({ card: 15, swish_out: 2, swish_in: 2, swish_refund: 1, autogiro: 3, deposit: 1, other: 4 });
  });

  it('never leaves a card purchase dated after its booking', () => {
    for (const d of described) if (d.purchaseDate) expect(d.purchaseDate <= d.effectiveDate).toBe(true);
  });
});
