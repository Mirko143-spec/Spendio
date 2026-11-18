import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import type { Category } from '../core/categories.ts';
import type { ImportResult } from '../core/import.ts';
import { groupForReview, type ReviewGroup } from '../core/review.ts';
import { openStore, type SpendioStore } from '../storage/store.ts';
import { ImportSummary } from './ImportSummary.tsx';
import { ReviewScreen } from './ReviewScreen.tsx';
import { UploadScreen } from './UploadScreen.tsx';

// Dev-only previews; `import.meta.env.DEV` is false in production builds, so they are dropped.
const ReviewPreview = import.meta.env.DEV ? lazy(() => import('./dev/ReviewPreview.tsx')) : null;

/** Page frame: wordmark, one centered reading column, and the privacy promise. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[44rem] flex-col px-4 sm:px-6">
      <header className="flex items-center gap-2.5 pt-6 pb-10 sm:pt-8">
        <img src="/favicon.svg" alt="" className="size-7" />
        <span className="text-lg font-bold tracking-[-0.02em]">Spendio</span>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="py-8 text-sm text-ink-muted">Your bank data stays on this device.</footer>
    </div>
  );
}

type Screen =
  | { name: 'upload' }
  | { name: 'summary'; result: ImportResult; reviewCount: number }
  | { name: 'review'; groups: ReviewGroup[]; categories: Category[] }
  | { name: 'saved' };

const newId = () => crypto.randomUUID();
const now = () => new Date().toISOString();

export function App({ dbName }: { dbName?: string } = {}) {
  if (ReviewPreview && new URLSearchParams(window.location.search).get('preview') === 'review') {
    return (
      <AppShell>
        <Suspense>
          <ReviewPreview />
        </Suspense>
      </AppShell>
    );
  }
  return <ImportFlow dbName={dbName} />;
}

function ImportFlow({ dbName }: { dbName?: string }) {
  const [store, setStore] = useState<SpendioStore | null>(null);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: 'upload' });

  useEffect(() => {
    let opened: SpendioStore | undefined;
    openStore(dbName).then(
      (s) => setStore((opened = s)),
      (e: unknown) => setStoreError(e instanceof Error ? e.message : String(e)),
    );
    return () => opened?.close();
  }, [dbName]);

  if (storeError) {
    return (
      <AppShell>
        <h1 className="text-title font-semibold tracking-[-0.015em]">Spendio can’t save data in this browser</h1>
        <p role="alert" className="mt-4 max-w-prose text-ink-muted">
          Spendio stores your transactions in this browser, and that storage isn’t available here ({storeError}).
          Private browsing windows often block it. Open Spendio in a normal window to continue.
        </p>
      </AppShell>
    );
  }
  if (!store) return <AppShell>{null}</AppShell>;

  const reviewGroups = async () => groupForReview(await store.listTransactions());

  async function importFile(text: string) {
    const result = await store!.importCsv(text, { now: now(), newId });
    const reviewCount = (await reviewGroups()).reduce((n, g) => n + g.transactionIds.length, 0);
    setScreen({ name: 'summary', result, reviewCount });
  }

  async function startReview() {
    setScreen({ name: 'review', groups: await reviewGroups(), categories: await store!.listCategories() });
  }

  return (
    <AppShell>
      {screen.name === 'upload' && <UploadScreen onImport={importFile} />}
      {screen.name === 'summary' && (
        <ImportSummary
          result={screen.result}
          reviewCount={screen.reviewCount}
          onReview={() => void startReview()}
          onDone={() => setScreen({ name: 'saved' })}
        />
      )}
      {screen.name === 'review' && (
        <ReviewScreen
          groups={screen.groups}
          categories={screen.categories}
          onSave={(decisions) =>
            void store.applyReviewDecisions(decisions, { now: now(), newId }).then(() => setScreen({ name: 'saved' }))
          }
          onSkip={() => setScreen({ name: 'saved' })}
        />
      )}
      {screen.name === 'saved' && (
        <section aria-labelledby="saved-title">
          <h1 id="saved-title" className="text-title font-semibold tracking-[-0.015em]">
            Saved on this device
          </h1>
          <p className="mt-4 max-w-prose text-ink-muted">
            Your transactions are stored in this browser. Add your next statement whenever you like; anything you
            already imported is skipped automatically.
          </p>
          <button
            type="button"
            onClick={() => setScreen({ name: 'upload' })}
            className="mt-8 rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-ink"
          >
            Add another statement
          </button>
        </section>
      )}
    </AppShell>
  );
}
