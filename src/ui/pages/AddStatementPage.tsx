import { useState } from 'react';
import type { ImportResult } from '../../core/import.ts';
import { groupForReview } from '../../core/review.ts';
import { ImportSummary } from '../ImportSummary.tsx';
import { navigate } from '../router.ts';
import { useStore } from '../useStore.ts';
import { UploadScreen } from '../UploadScreen.tsx';

const newId = () => crypto.randomUUID();

/** Upload a statement, then see what the import did. */
export function AddStatementPage() {
  const store = useStore();
  const [done, setDone] = useState<{ result: ImportResult; reviewCount: number } | null>(null);

  async function importFile(text: string) {
    const result = await store.importCsv(text, { now: new Date().toISOString(), newId });
    const groups = groupForReview(await store.listTransactions());
    setDone({ result, reviewCount: groups.reduce((n, g) => n + g.transactionIds.length, 0) });
  }

  if (!done) return <UploadScreen onImport={importFile} />;
  return (
    <ImportSummary
      result={done.result}
      reviewCount={done.reviewCount}
      onReview={() => navigate('review')}
      onDone={() => navigate('overview')}
    />
  );
}
