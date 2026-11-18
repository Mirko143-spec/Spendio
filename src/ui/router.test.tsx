// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { hrefFor, navigate, replaceParams, useRoute, useRouteParams } from './router.ts';

beforeEach(() => {
  window.location.hash = '';
});

describe('hrefFor', () => {
  it('builds hash links with optional, non-empty parameters', () => {
    expect(hrefFor('overview')).toBe('#/');
    expect(hrefFor('transactions', { period: '2026-11', category: 'gaming' })).toBe(
      '#/transactions?period=2026-11&category=gaming',
    );
    expect(hrefFor('transactions', { period: null, q: '' })).toBe('#/transactions');
  });
});

describe('useRoute / useRouteParams', () => {
  it('reads the route and its parameters, and follows navigation', async () => {
    const { result } = renderHook(() => ({ route: useRoute(), params: useRouteParams() }));
    expect(result.current.route).toBe('overview');

    await act(async () => {
      navigate('transactions', { category: 'gaming' });
      await new Promise((r) => setTimeout(r, 0)); // hashchange is async
    });
    expect(result.current.route).toBe('transactions');
    expect(result.current.params.get('category')).toBe('gaming');
  });

  it('reads the welcome page', () => {
    window.location.hash = '#/welcome';
    const { result } = renderHook(() => useRoute());
    expect(result.current).toBe('welcome');
    expect(hrefFor('welcome')).toBe('#/welcome');
  });

  it('treats unknown paths as the overview', () => {
    window.location.hash = '#/nope';
    const { result } = renderHook(() => useRoute());
    expect(result.current).toBe('overview');
  });

  it('replaces parameters in place without adding history', () => {
    window.location.hash = '#/transactions';
    const lengthBefore = window.history.length;
    const { result } = renderHook(() => useRouteParams());
    act(() => replaceParams({ q: 'roblox' }));
    expect(window.location.hash).toBe('#/transactions?q=roblox');
    expect(result.current.get('q')).toBe('roblox');
    expect(window.history.length).toBe(lengthBefore);
  });
});
