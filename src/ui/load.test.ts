import { describe, expect, it, vi } from 'vitest';
import { loadWhileMounted } from './load.ts';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('loadWhileMounted', () => {
  it('applies the result while mounted', async () => {
    const apply = vi.fn();
    loadWhileMounted(() => Promise.resolve(3), apply);
    await tick();
    expect(apply).toHaveBeenCalledWith(3);
  });

  it('drops the result and the error once unmounted', async () => {
    const apply = vi.fn();
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    loadWhileMounted(() => Promise.resolve(3), apply)();
    loadWhileMounted(() => Promise.reject(new Error('Database has been closed')), apply)();
    await tick();
    process.off('unhandledRejection', unhandled);
    expect(apply).not.toHaveBeenCalled();
    expect(unhandled).not.toHaveBeenCalled();
  });
});
