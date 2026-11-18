import Dexie from 'dexie';
import { openStore, type SpendioStore } from './store.ts';

/** Test helper: a fresh, isolated store backed by in-memory IndexedDB. */
export async function freshStore(): Promise<SpendioStore & { [Symbol.asyncDispose](): Promise<void> }> {
  const name = `spendio-test-${crypto.randomUUID()}`;
  const store = await openStore(name);
  return Object.assign(store, {
    async [Symbol.asyncDispose]() {
      store.close();
      await Dexie.delete(name);
    },
  });
}
