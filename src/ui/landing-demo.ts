import { DEFAULT_CATEGORIES } from '../core/categories.ts';
import { importCsv } from '../core/import.ts';
import { counterpartyName } from './format.ts';
import { SAMPLE_CSV } from './sample-data.ts';

export interface DemoRow {
  /** The line as it appears in the bank statement. */
  raw: string;
  amount: number;
  /** What Spendio makes of it. */
  name: string;
  category: string;
  color: string;
}

// Lines from the sample statement that show what sorting does: reference codes stripped,
// savings kept apart from spending, money back from a friend lowering spending.
const PICKS = [
  'Kortköp 261103 Spotify P1234ABCD5',
  'Kortköp 261019 ICA SUPERMARKET TESTBY',
  'Kortköp 261023 Espresso House 123',
  'Autogiro Lysa Spar',
  'Swish inbetalning ANNA TESTSSON',
];

/**
 * The landing page's "before and after", computed by the real importer from the bundled sample
 * statement, so the page can only show what the app actually does.
 */
export function demoRows(): DemoRow[] {
  const { transactions } = importCsv(SAMPLE_CSV, { existingFingerprints: new Set(), now: '2026-01-01T00:00:00.000Z', newId: () => 'demo' });
  return PICKS.flatMap((raw) => {
    const t = transactions.find((x) => x.description === raw);
    const category = DEFAULT_CATEGORIES.find((c) => c.id === t?.categoryId);
    if (!t || !category) return [];
    return [{ raw, amount: t.amount, name: counterpartyName(t), category: category.name, color: category.color }];
  });
}
