import { useMemo, useSyncExternalStore } from 'react';

/**
 * Hash routes, so the static host needs no rewrites and no router library is needed.
 * Query parameters after the route (`#/transactions?period=2026-11&category=gaming`) hold page
 * state such as filters, so a filtered view can be bookmarked or linked to.
 */
export type Route = 'overview' | 'add' | 'review' | 'transactions';

const PATHS: Record<Route, string> = { overview: '#/', add: '#/add', review: '#/review', transactions: '#/transactions' };

/** Fired when params are replaced in place (replaceState doesn't fire `hashchange`). */
const REPLACED = 'spendio:route-replaced';

type Params = Record<string, string | null | undefined>;

function toQuery(params: Params = {}): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
  const text = query.toString();
  return text ? `?${text}` : '';
}

export function hrefFor(route: Route, params?: Params): string {
  return `${PATHS[route]}${toQuery(params)}`;
}

function parse(hash: string): { route: Route; params: URLSearchParams } {
  const [path = '', query = ''] = hash.split('?');
  const route = (Object.keys(PATHS) as Route[]).find((r) => r !== 'overview' && PATHS[r] === path) ?? 'overview';
  return { route, params: new URLSearchParams(query) };
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  window.addEventListener(REPLACED, onChange);
  return () => {
    window.removeEventListener('hashchange', onChange);
    window.removeEventListener(REPLACED, onChange);
  };
}

const getHash = () => window.location.hash;

export function useRoute(): Route {
  return parse(useSyncExternalStore(subscribe, getHash)).route;
}

/** The current route's query parameters. */
export function useRouteParams(): URLSearchParams {
  const hash = useSyncExternalStore(subscribe, getHash);
  return useMemo(() => parse(hash).params, [hash]);
}

/** Goes to a page (adds a browser history entry). */
export function navigate(route: Route, params?: Params): void {
  window.location.hash = hrefFor(route, params);
}

/** Replaces the current page's parameters without adding a history entry (e.g. while typing a search). */
export function replaceParams(params: Params): void {
  const { route } = parse(window.location.hash);
  window.history.replaceState(window.history.state, '', hrefFor(route, params));
  window.dispatchEvent(new Event(REPLACED));
}
