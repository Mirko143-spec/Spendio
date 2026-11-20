import { useEffect, useState } from 'react';
import { Landing } from '../Landing.tsx';
import { loadWhileMounted } from '../load.ts';
import { navigate } from '../router.ts';
import { SAMPLE_CSV } from '../sample-data.ts';
import { newId } from '../new-id.ts';
import { useStore } from '../useStore.ts';

/** The landing page: what Spendio is, and a way in (docs/SPEC.md §12). */
export function WelcomePage() {
  const store = useStore();
  const [hasData, setHasData] = useState<boolean | null>(null);

  useEffect(() => loadWhileMounted(() => store.countTransactions(), (n) => setHasData(n > 0)), [store]);

  async function trySample() {
    await store.loadSampleData(SAMPLE_CSV, { now: new Date().toISOString(), newId: newId });
    navigate('overview');
  }

  if (hasData === null) return null;
  return <Landing hasData={hasData} onTrySample={trySample} />;
}
