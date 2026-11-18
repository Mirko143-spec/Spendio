import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Architecture guard: bank- and country-specific code stays in its folder. Bank-neutral core
 * code reaches it only through the registries (`formats/index.ts`, `country/index.ts`).
 */
const CORE = import.meta.dirname;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return name.endsWith('.ts') && !name.endsWith('.test.ts') ? [path] : [];
  });
}

const RULES = [
  { specific: 'country/se/', allowedIn: ['country/se/', 'country/index.ts', 'formats/nordea/'] },
  { specific: 'formats/nordea/', allowedIn: ['formats/nordea/', 'formats/index.ts'] },
];

describe('core boundaries', () => {
  const files = sourceFiles(CORE).map((path) => ({ file: relative(CORE, path), text: readFileSync(path, 'utf8') }));

  it.each(RULES)('only $allowedIn import from $specific', ({ specific, allowedIn }) => {
    const offenders = files
      .filter(({ file }) => !allowedIn.some((allowed) => file.startsWith(allowed)))
      .filter(({ text }) => new RegExp(`from '[./]*${specific}`).test(text))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('finds the source files it is guarding', () => {
    expect(files.length).toBeGreaterThan(20);
  });
});
