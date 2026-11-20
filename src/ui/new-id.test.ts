import { afterEach, describe, expect, it, vi } from 'vitest';
import { newId } from './new-id.ts';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('newId', () => {
  it('makes random v4 UUIDs', () => {
    const ids = Array.from({ length: 1000 }, newId);
    for (const id of ids) expect(id).toMatch(UUID_V4);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('works where crypto.randomUUID doesn’t exist (plain-HTTP pages, older Safari)', () => {
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });
    expect(newId()).toMatch(UUID_V4);
  });
});
