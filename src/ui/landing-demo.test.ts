import { describe, expect, it } from 'vitest';
import { demoRows } from './landing-demo.ts';

describe('demoRows', () => {
  it('shows what the importer makes of sample statement lines', () => {
    expect(demoRows().map(({ raw, name, category }) => [raw, name, category])).toEqual([
      ['Kortköp 260928 H&M SE0412', 'H&M', 'Shopping'],
      ['Kortköp 261116 WILLYS GBG LINNE', 'WILLYS GBG LINNE', 'Groceries'],
      ['Kortköp 261002 FOODORA AB', 'FOODORA AB', 'Restaurants & Cafés'],
      ['Autogiro Avanza', 'Avanza', 'Transfer: Savings'],
      ['Swish inbetalning OSKAR TESTBERG', 'Oskar Testberg', 'Swish from people'],
    ]);
  });
});
