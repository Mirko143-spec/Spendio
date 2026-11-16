export function App() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 py-8">
      <header className="flex items-center gap-2">
        <img src="/favicon.svg" alt="" className="size-8" />
        <h1 className="text-2xl font-semibold tracking-tight">Spendio</h1>
      </header>
      <main className="mt-8 flex-1">
        <p className="text-zinc-600 dark:text-zinc-400">
          Upload your bank statement and see where your money goes.
        </p>
      </main>
      <footer className="mt-8 text-sm text-zinc-500">
        Your bank data never leaves this device.
      </footer>
    </div>
  );
}
