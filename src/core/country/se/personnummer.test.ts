import { describe, expect, it } from 'vitest';
import { containsPersonnummer, luhnValid, REDACTED, redactPersonnummer } from './personnummer.ts';

// Test values only. 121212-1212 is Skatteverket's well-known test identity ("Tolvan Tolvansson").
// Other valid-looking numbers are built with `withCheckDigit` so no real person's number is used.
function withCheckDigit(nineDigits: string): string {
  for (let d = 0; d <= 9; d++) if (luhnValid(nineDigits + d)) return nineDigits + d;
  throw new Error('unreachable');
}

const TOLVAN = '121212-1212';
const SAMORDNING = withCheckDigit('121272121'); // day 12 + 60
const SAMORDNING_DASHED = `${SAMORDNING.slice(0, 6)}-${SAMORDNING.slice(6)}`;

describe('luhnValid', () => {
  it('validates the check digit', () => {
    expect(luhnValid('1212121212')).toBe(true);
    expect(luhnValid('1212121213')).toBe(false);
  });
});

describe('redactPersonnummer', () => {
  it.each([
    ['YYMMDD-XXXX', `Swish från ${TOLVAN}`, `Swish från ${REDACTED}`],
    ['YYMMDD+XXXX (100+ years old)', 'ref 121212+1212', `ref ${REDACTED}`],
    ['YYYYMMDD-XXXX', 'Betalare 19121212-1212', `Betalare ${REDACTED}`],
    ['YYMMDDXXXX (Luhn-valid)', 'id 1212121212 x', `id ${REDACTED} x`],
    ['YYYYMMDDXXXX (Luhn-valid)', '191212121212', REDACTED],
    ['samordningsnummer, dashed', SAMORDNING_DASHED, REDACTED],
    ['samordningsnummer, bare', SAMORDNING, REDACTED],
    ['multiple in one string', `${TOLVAN};${TOLVAN}`, `${REDACTED};${REDACTED}`],
  ])('redacts %s', (_, input, expected) => {
    expect(redactPersonnummer(input)).toBe(expected);
  });

  it.each([
    ['fixture placeholder (month 00)', '000000-0000'],
    ['Nordea deposit reference', 'Insättning 4238 13 04548'],
    ['card purchase with date and code', 'Kortköp 261114 Spotify P4938CFA38'],
    ['merchant reference number', 'Kortköp 261102 ROBLOX.COM 188885825'],
    ['booking date', '2026/11/16'],
    ['bare 10 digits failing Luhn', 'ref 1212121213'],
    ['invalid month', '121312-1212'],
    ['invalid day', '120231-1234'],
    ['inside a longer digit run', '11212121212'],
    ['unknown century', '21121212-1212'],
  ])('leaves %s untouched', (_, input) => {
    expect(redactPersonnummer(input)).toBe(input);
  });
});

describe('containsPersonnummer', () => {
  it('reports whether anything would be redacted', () => {
    expect(containsPersonnummer(`Swish ${TOLVAN}`)).toBe(true);
    expect(containsPersonnummer('Kortköp 261114 Spotify')).toBe(false);
  });
});
