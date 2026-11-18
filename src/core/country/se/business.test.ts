import { describe, expect, it } from 'vitest';
import { looksLikeBusiness } from './business.ts';

describe('looksLikeBusiness', () => {
  it.each(['EXEMPELBUTIKEN AB', 'AB STORSTOCKHOLMS L', 'STIFTELSEN EXEMPELHUSET', 'Exempel Handelsbolag HB'])(
    '%s is a business',
    (name) => {
    expect(looksLikeBusiness(name)).toBe(true);
  });

  it.each(['ANNA TESTSSON', 'DOE,JOHN', 'Abbe Testsson', 'KBARNA EXEMPEL', 'Idrottsföreningen Exempel'])(
    '%s is not flagged (no whole-word marker)',
    (name) => {
      expect(looksLikeBusiness(name)).toBe(false);
    },
  );
});
