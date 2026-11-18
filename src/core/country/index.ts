import { SWEDEN } from './se/index.ts';
import type { Country } from './types.ts';

/** Every supported country, by code. v1 supports Sweden only. */
export const COUNTRIES: Readonly<Record<string, Country>> = { [SWEDEN.code]: SWEDEN };

/** The country used when none is specified (v1: Sweden). */
export const DEFAULT_COUNTRY: Country = SWEDEN;

export function countryFor(code: string): Country {
  const country = COUNTRIES[code];
  if (!country) throw new Error(`Unsupported country: ${code}`);
  return country;
}
