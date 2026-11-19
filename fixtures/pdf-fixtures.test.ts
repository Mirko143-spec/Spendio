import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Guard: PDF fixtures must be synthetic, like the CSV ones (see fixtures.test.ts). Their text is
// drawn uncompressed, so reading the raw bytes as Latin-1 sees every character on the page.
const PLACEHOLDER_ID = '000000-0000';
const PERSONNUMMER_LIKE = /\b(?:\d{2})?\d{6}[-+]\d{4}\b|\b\d{10}\b|\b\d{12}\b/g;

const dir = import.meta.dirname;
const pdfFiles = readdirSync(dir).filter((f) => f.endsWith('.pdf'));

describe('PDF fixtures', () => {
  it.each(pdfFiles)('%s has uncompressed text with no personnummer-like values except the placeholder', (file) => {
    // The trailing xref table lists byte offsets as 10-digit numbers; only the content before it matters.
    const raw = readFileSync(join(dir, file)).toString('latin1').split(/\nxref\n/)[0]!;
    expect(raw).not.toContain('/Filter'); // compressed streams would hide their text from this check
    const hits = (raw.match(PERSONNUMMER_LIKE) ?? []).filter((m) => m !== PLACEHOLDER_ID);
    expect(hits).toEqual([]);
  });

  it.each(pdfFiles)('%s has no personnummer in its filename', (file) => {
    expect(file).not.toMatch(/\d{6}[-+]?\d{4}/);
  });
});
