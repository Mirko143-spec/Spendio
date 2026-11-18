import { createContext, useContext } from 'react';
import type { SpendioStore } from '../storage/store.ts';

export const StoreContext = createContext<SpendioStore | null>(null);

/** The app's store, opened once by `StoreProvider`. */
export function useStore(): SpendioStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside StoreProvider');
  return store;
}
