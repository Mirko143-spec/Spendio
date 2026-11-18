import type { PeriodLabel } from '../core/periods.ts';
import { useRouteParams } from './router.ts';

/** How many periods month-by-month pages (History, Savings) show at once. */
export const WINDOW = 6;

const LABEL = /^\d{4}-(0[1-9]|1[0-2])$/;

/** The window's last period from the URL (`?end=YYYY-MM`), or null to use where the data opens. */
export function useRequestedWindowEnd(): PeriodLabel | null {
  const requested = useRouteParams().get('end');
  return requested && LABEL.test(requested) ? requested : null;
}
