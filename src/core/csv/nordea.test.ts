import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isNordeaCsv, parseNordeaCsv } from './nordea.ts';

const fixture = readFileSync(join(import.meta.dirname, '../../../fixtures/nordea-sample.csv'), 'utf8');

const HEADER = 'Bokföringsdag;Belopp;Avsändare;Mottagare;Namn;Rubrik;Saldo;Valuta;';
const csv = (...lines: string[]) => '﻿' + [HEADER, ...lines].join('\n');

describe('isNordeaCsv', () => {
  it('recognizes the Nordea header, with or without BOM and trailing delimiter', () => {
    expect(isNordeaCsv(fixture)).toBe(true);
    expect(isNordeaCsv(HEADER.slice(0, -1) + '\n')).toBe(true);
  });

  it('rejects other CSV layouts', () => {
    expect(isNordeaCsv('Date,Amount,Description\n2026-11-01,-10.00,Coffee')).toBe(false);
    expect(isNordeaCsv('')).toBe(false);
  });
});

describe('parseNordeaCsv on the synthetic fixture', () => {
  const { rows, errors } = parseNordeaCsv(fixture);

  it('parses every row without errors', () => {
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(28);
  });

  it('maps the newest row correctly', () => {
    expect(rows[0]).toEqual({
      line: 2,
      bookingDate: '2026-12-28',
      amount: -2700,
      description: 'Kortköp 261227 Pressbyran 4200001',
      balance: 3180854,
      currency: 'SEK',
    });
  });

  it('keeps file order (newest first)', () => {
    const dates = rows.map((r) => r.bookingDate);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it('never carries the ID columns (Avsändare/Mottagare) into the output', () => {
    expect(JSON.stringify(rows)).not.toContain('000000-0000');
    for (const row of rows) expect(Object.keys(row).sort()).toEqual(
      ['amount', 'balance', 'bookingDate', 'currency', 'description', 'line'],
    );
  });

  it('keeps identical same-day rows as separate rows with different balances', () => {
    const roblox = rows.filter((r) => r.description.includes('ROBLOX'));
    expect(roblox).toHaveLength(2);
    expect(roblox[0]!.balance).not.toBe(roblox[1]!.balance);
  });
});

describe('parseNordeaCsv edge cases', () => {
  it('redacts personnummer found in the description or name', () => {
    const { rows } = parseNordeaCsv(csv('2026/11/01;-100,00;;;121212-1212;Swish betalning 121212-1212;0,00;SEK;'));
    expect(rows[0]!.description).toBe('Swish betalning [redacted] [redacted]');
  });

  it('appends a non-empty Namn to the description', () => {
    const { rows } = parseNordeaCsv(csv('2026/11/01;-50,00;;;EXEMPEL AB;Autogiro;0,00;SEK;'));
    expect(rows[0]!.description).toBe('Autogiro EXEMPEL AB');
  });

  it('handles CRLF line endings, missing trailing delimiters and blank lines', () => {
    const text = `${HEADER}\r\n2026/11/01;-1,00;;;;A;9,00;SEK\r\n\r\n2026/10/31;10,00;;;;B;10,00;SEK;\r\n`;
    const { rows, errors } = parseNordeaCsv(text);
    expect(errors).toEqual([]);
    expect(rows.map((r) => [r.line, r.description])).toEqual([[2, 'A'], [4, 'B']]);
  });

  it('accepts ISO dates with dashes', () => {
    expect(parseNordeaCsv(csv('2026-11-01;-1,00;;;;A;0,00;SEK;')).rows[0]!.bookingDate).toBe('2026-11-01');
  });

  it('treats a missing balance as absent', () => {
    expect(parseNordeaCsv(csv('2026/11/01;-1,00;;;;A;;SEK;')).rows[0]).not.toHaveProperty('balance');
  });

  it('reports bad lines with their line number and keeps the good ones', () => {
    const { rows, errors } = parseNordeaCsv(
      csv(
        '2026/11/01;-1,00;;;;OK;0,00;SEK;',
        '2026/02/30;-1,00;;;;Bad date;0,00;SEK;',
        '2026/11/01;abc;;;;Bad amount;0,00;SEK;',
        '2026/11/01;-1,00;;;;Euro;0,00;EUR;',
        '2026/11/01;-1,00;;;;;0,00;SEK;',
      ),
    );
    expect(rows.map((r) => r.description)).toEqual(['OK']);
    expect(errors).toEqual([
      { line: 3, message: 'Invalid date: "2026/02/30"' },
      { line: 4, message: 'Invalid amount: "abc"' },
      { line: 5, message: 'Unsupported currency: "EUR"' },
      { line: 6, message: 'Missing description' },
    ]);
  });

  it('refuses files that are not Nordea exports', () => {
    expect(() => parseNordeaCsv('Date,Amount\n')).toThrow(/Not a Nordea CSV/);
  });
});
