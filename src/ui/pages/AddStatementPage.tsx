import { useState } from 'react';
import { sniffCsv } from '../../core/csv/sniff.ts';
import { UnsupportedFormatError, type ImportResult } from '../../core/import.ts';
import { groupForReview } from '../../core/review.ts';
import { CsvMapper } from '../CsvMapper.tsx';
import { ImportSummary } from '../ImportSummary.tsx';
import { navigate } from '../router.ts';
import { UploadScreen } from '../UploadScreen.tsx';
import { useStore } from '../useStore.ts';

const newId = () => crypto.randomUUID();
const now = () => new Date().toISOString();

/** True if the text reads as a table worth mapping: at least two columns and one data row. */
function looksLikeTable(text: string): boolean {
  const sample = sniffCsv(text);
  return sample.header.length >= 2 && sample.rows.length > 0;
}

type Step = { name: 'upload' } | { name: 'map'; text: string } | { name: 'done'; result: ImportResult; reviewCount: number };

/** Upload a statement — setting up its layout first if no bank format knows it — then see what the import did. */
export function AddStatementPage() {
  const store = useStore();
  const [step, setStep] = useState<Step>({ name: 'upload' });

  async function importText(text: string) {
    const result = await store.importCsv(text, { now: now(), newId });
    const groups = groupForReview(await store.listTransactions());
    setStep({ name: 'done', result, reviewCount: groups.reduce((n, g) => n + g.transactionIds.length, 0) });
  }

  async function importFile(text: string) {
    try {
      await importText(text);
    } catch (e) {
      // An unknown layout that is still a table gets set up once; anything else is an error.
      if (e instanceof UnsupportedFormatError && looksLikeTable(text)) return setStep({ name: 'map', text });
      throw e;
    }
  }

  if (step.name === 'upload') return <UploadScreen onImport={importFile} />;
  if (step.name === 'map') {
    return (
      <CsvMapper
        text={step.text}
        newId={newId}
        now={now}
        onCancel={() => setStep({ name: 'upload' })}
        onSave={async (mapping) => {
          await store.saveCsvMapping(mapping);
          await importText(step.text);
        }}
      />
    );
  }
  return (
    <ImportSummary
      result={step.result}
      reviewCount={step.reviewCount}
      onReview={() => navigate('review')}
      onDone={() => navigate('overview')}
    />
  );
}
