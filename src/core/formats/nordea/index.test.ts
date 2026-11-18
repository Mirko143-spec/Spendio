import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NORDEA } from './index.ts';

const fixture = readFileSync(join(import.meta.dirname, '../../../../fixtures/nordea-sample.csv'), 'utf8');

describe('NORDEA bank format', () => {
  it('identifies itself', () => {
    expect(NORDEA).toMatchObject({ id: 'nordea', name: 'Nordea', country: 'SE' });
  });

  it('detects and parses the Nordea fixture', () => {
    expect(NORDEA.detect(fixture)).toBe(true);
    const { rows, errors } = NORDEA.parse(fixture);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(28);
  });

  it('does not claim other CSV layouts', () => {
    expect(NORDEA.detect('Datum,Belopp,Text\n2026-11-01,-10.00,Kaffe')).toBe(false);
  });

  it('reads Nordea descriptions', () => {
    expect(NORDEA.describe('Kortköp 261124 PARKSTER SWE', '2026-11-25')).toMatchObject({
      kind: 'card',
      counterparty: 'PARKSTER SWE',
      effectiveDate: '2026-11-24',
    });
  });
});
