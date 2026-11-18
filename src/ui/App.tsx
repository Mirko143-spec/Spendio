import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { AddStatementPage } from './pages/AddStatementPage.tsx';
import { CategoriesPage } from './pages/CategoriesPage.tsx';
import { HistoryPage } from './pages/HistoryPage.tsx';
import { OverviewPage } from './pages/OverviewPage.tsx';
import { ReviewPage } from './pages/ReviewPage.tsx';
import { TransactionsPage } from './pages/TransactionsPage.tsx';
import { hrefFor, navigate, useRoute, type Route } from './router.ts';
import { StoreProvider } from './StoreContext.tsx';
import { useStore } from './useStore.ts';

// Dev-only previews; `import.meta.env.DEV` is false in production builds, so they are dropped.
const ReviewPreview = import.meta.env.DEV ? lazy(() => import('./dev/ReviewPreview.tsx')) : null;

const NAV: { route: Route; label: string }[] = [
  { route: 'overview', label: 'Overview' },
  { route: 'transactions', label: 'Transactions' },
  { route: 'history', label: 'History' },
  { route: 'categories', label: 'Categories' },
  { route: 'add', label: 'Add statement' },
];

/** Page frame: wordmark, navigation, one centered reading column, and the privacy promise. */
export function AppShell({ children, nav = true }: { children: ReactNode; nav?: boolean }) {
  const route = useRoute();
  return (
    <div className="mx-auto flex min-h-dvh max-w-[44rem] flex-col px-4 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 pt-6 pb-10 sm:pt-8">
        <a href={hrefFor('overview')} className="flex items-center gap-2.5">
          <img src="/favicon.svg" alt="" className="size-7" />
          <span className="text-lg font-bold tracking-[-0.02em]">Spendio</span>
        </a>
        {nav && (
          <nav aria-label="Main" className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {NAV.map((item) => (
              <a
                key={item.route}
                href={hrefFor(item.route)}
                aria-current={route === item.route ? 'page' : undefined}
                className={`whitespace-nowrap ${route === item.route ? 'font-semibold text-ink' : 'text-ink-muted hover:text-ink'}`}
              >
                {item.label}
              </a>
            ))}
          </nav>
        )}
      </header>
      <main className="flex-1">{children}</main>
      <footer className="py-8 text-sm text-ink-muted">Your bank data stays on this device.</footer>
    </div>
  );
}

function StorageUnavailable({ message }: { message: string }) {
  return (
    <AppShell nav={false}>
      <h1 className="text-title font-semibold tracking-[-0.015em]">Spendio can’t save data in this browser</h1>
      <p role="alert" className="mt-4 max-w-prose text-ink-muted">
        Spendio stores your transactions in this browser, and that storage isn’t available here ({message}). Private
        browsing windows often block it. Open Spendio in a normal window to continue.
      </p>
    </AppShell>
  );
}

/** Sends a first-time visitor (no transactions yet) to "Add statement" instead of an empty overview. */
function useFirstVisitRedirect(): boolean {
  const store = useStore();
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    void store.countTransactions().then((count) => {
      if (count === 0 && window.location.hash === '') navigate('add');
      setChecked(true);
    });
  }, [store]);
  return checked;
}

function Pages() {
  const route = useRoute();
  if (!useFirstVisitRedirect()) return <AppShell>{null}</AppShell>;
  return (
    <AppShell>
      {route === 'overview' && <OverviewPage />}
      {route === 'add' && <AddStatementPage key="add" />}
      {route === 'review' && <ReviewPage />}
      {route === 'transactions' && <TransactionsPage />}
      {route === 'history' && <HistoryPage />}
      {route === 'categories' && <CategoriesPage />}
    </AppShell>
  );
}

export function App({ dbName }: { dbName?: string } = {}) {
  if (ReviewPreview && new URLSearchParams(window.location.search).get('preview') === 'review') {
    return (
      <AppShell nav={false}>
        <Suspense>
          <ReviewPreview />
        </Suspense>
      </AppShell>
    );
  }
  return (
    <StoreProvider dbName={dbName} renderError={(message) => <StorageUnavailable message={message} />}>
      <Pages />
    </StoreProvider>
  );
}
