import { describe, expect, it } from 'vitest';
import { demoRows } from './landing-demo.ts';

describe('demoRows', () => {
  it('shows what the importer makes of sample statement lines', () => {
    expect(demoRows().map(({ raw, name, category }) => [raw, name, category])).toEqual([
      ['Kortköp 261103 Spotify P1234ABCD5', 'Spotify', 'Subscriptions'],
      ['Kortköp 261019 ICA SUPERMARKET TESTBY', 'ICA SUPERMARKET TESTBY', 'Groceries'],
      ['Kortköp 261023 Espresso House 123', 'Espresso House', 'Restaurants & Cafés'],
      ['Autogiro Lysa Spar', 'Lysa Spar', 'Transfer: Savings'],
      ['Swish inbetalning ANNA TESTSSON', 'Anna Testsson', 'Swish from people'],
    ]);
  });
});
