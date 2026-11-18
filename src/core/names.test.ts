import { describe, expect, it } from 'vitest';
import { tidyPersonName } from './names.ts';

describe('tidyPersonName', () => {
  it.each([
    ['DOE,JOHN', 'John Doe'],
    ['DOE, JOHN', 'John Doe'],
    ['ANNA TESTSSON', 'Anna Testsson'],
    ['ANNA-KARIN TESTSSON', 'Anna-Karin Testsson'],
    ['ÅSA ÖSTLUND', 'Åsa Östlund'],
    ['anna testsson', 'Anna Testsson'],
    ['  ANNA   TESTSSON ', 'Anna Testsson'],
    ['Anna McTestsson', 'Anna McTestsson'], // mixed case is kept as written
    ['TESTSSON,', 'Testsson'], // dangling comma
  ])('%j → %j', (raw, expected) => {
    expect(tidyPersonName(raw)).toBe(expected);
  });
});
