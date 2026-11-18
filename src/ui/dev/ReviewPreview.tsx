// Dev-only: renders the review screen from the synthetic fixture (open /?preview=review).
// Never part of production builds (see App.tsx).
import { useState } from 'react';
import fixture from '../../../fixtures/nordea-sample.csv?raw';
import { DEFAULT_CATEGORIES } from '../../core/categories.ts';
import { importCsv } from '../../core/import.ts';
import { groupForReview, type ReviewDecision } from '../../core/review.ts';
import { ReviewScreen } from '../ReviewScreen.tsx';

let seq = 0;
const { transactions } = importCsv(fixture, {
  existingFingerprints: new Set(),
  now: new Date().toISOString(),
  newId: () => `preview-${++seq}`,
});

export default function ReviewPreview() {
  const [saved, setSaved] = useState<ReviewDecision[] | null>(null);
  if (saved) return <pre className="text-sm whitespace-pre-wrap">{JSON.stringify(saved, null, 2)}</pre>;
  return (
    <ReviewScreen
      groups={groupForReview(transactions)}
      categories={DEFAULT_CATEGORIES}
      onSave={setSaved}
      onSkip={() => setSaved([])}
    />
  );
}
