import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Guard: fixtures must be synthetic. The only ID allowed is the placeholder below.
const PLACEHOLDER_ID = '000000-0000';
const PERSONNUMMER_LIKE = /\b(?:\d{2})?\d{6}[-+]\d{4}\b|\b\d{10}\b|\b\d{12}\b/g;

const dir = import.meta.dirname;
const csvFiles = readdirSync(dir).filter((f) => f.endsWith('.csv'));

describe('fixtures', () => {
  it('has at least one CSV fixture', () => {
    expect(csvFiles.length).toBeGreaterThan(0);
  });

  it.each(csvFiles)('%s contains no personnummer-like values except the placeholder', (file) => {
    const text = readFileSync(join(dir, file), 'utf8');
    const hits = (text.match(PERSONNUMMER_LIKE) ?? []).filter((m) => m !== PLACEHOLDER_ID);
    expect(hits).toEqual([]);
  });

  it.each(csvFiles)('%s has no personnummer in its filename', (file) => {
    expect(file).not.toMatch(/\d{6}[-+]?\d{4}/);
  });
});

describe('nordea-sample.csv', () => {
  const text = readFileSync(join(dir, 'nordea-sample.csv'), 'utf8');
  const lines = text.split('\n');

  it('matches the real Nordea export quirks', () => {
    expect(text.startsWith('﻿')).toBe(true);
    expect(lines[0]).toBe('﻿Bokföringsdag;Belopp;Avsändare;Mottagare;Namn;Rubrik;Saldo;Valuta;');
    expect(text).not.toContain('\r');
    for (const line of lines) expect(line.endsWith(';')).toBe(true);
  });

  it('has consistent running balances (newest first)', () => {
    const toOre = (s: string) => Math.round(Number(s.replace(',', '.')) * 100);
    const rows = lines.slice(1).map((l) => l.split(';'));
    for (let i = 0; i < rows.length - 1; i++) {
      const [, amount, , , , , balance] = rows[i]!;
      const prevBalance = rows[i + 1]![6]!;
      expect(toOre(balance!) - toOre(amount!)).toBe(toOre(prevBalance));
    }
  });
});
