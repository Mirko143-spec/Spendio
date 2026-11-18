import { useSyncExternalStore } from 'react';

/** Hash routes, so the static host needs no rewrites and no router library is needed. */
export type Route = 'overview' | 'add' | 'review';

const PATHS: Record<Route, string> = { overview: '#/', add: '#/add', review: '#/review' };

export function hrefFor(route: Route): string {
  return PATHS[route];
}

function current(): Route {
  const hash = window.location.hash;
  return (Object.keys(PATHS) as Route[]).find((r) => PATHS[r] === hash && r !== 'overview') ?? 'overview';
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, current);
}

export function navigate(route: Route): void {
  window.location.hash = PATHS[route];
}
