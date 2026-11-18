import type { ReactNode } from 'react';

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

export function App() {
  return (
    <AppShell>
      <h1 className="text-title font-semibold tracking-[-0.015em]">See where your money goes</h1>
      <p className="mt-4 max-w-prose text-ink-muted">
        Upload a bank statement and Spendio sorts every purchase into a category, right here in your browser.
      </p>
    </AppShell>
  );
}
