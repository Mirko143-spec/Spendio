import { useEffect, useState, type ReactNode } from 'react';
import { openStore, type SpendioStore } from '../storage/store.ts';
import { StoreContext } from './useStore.ts';

/** Opens the store once for the whole app; renders nothing while opening and `renderError` if it can't. */
export function StoreProvider({
  dbName,
  children,
  renderError,
}: {
  dbName?: string;
  children: ReactNode;
  renderError: (message: string) => ReactNode;
}) {
  const [store, setStore] = useState<SpendioStore | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let opened: SpendioStore | undefined;
    openStore(dbName).then(
      (s) => setStore((opened = s)),
      (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
    );
    return () => opened?.close();
  }, [dbName]);

  if (error) return renderError(error);
  if (!store) return null;
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}
