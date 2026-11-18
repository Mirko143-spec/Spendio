import type { PeriodSettings } from '../periods.ts';
import type { Rule } from '../rules.ts';

/**
 * Everything country-specific the core needs (docs/SPEC.md §2). The core reads these through
 * a `Country` instead of importing a country's modules, so adding a country means adding one
 * folder under `country/` and registering it — no changes to the core.
 */
export interface Country {
  /** ISO 3166-1 alpha-2, e.g. "SE". Bank formats refer to their country by this code. */
  code: string;
  name: string;
  /** ISO 4217 currency code, e.g. "SEK". */
  currency: string;
  /** BCP 47 locale for formatting, e.g. "sv-SE". */
  locale: string;
  /** Default budget period (e.g. Swedish payday: the 25th, moved back to a banking day). */
  defaultPeriodSettings: PeriodSettings;
  /** Whether banks are open on this ISO date (weekends and public/bank holidays excluded). */
  isBankingDay(iso: string): boolean;
  /** Built-in merchant rules for this country's shops and services. */
  builtinRules: readonly Rule[];
  /** Replaces national ID numbers (e.g. personnummer) in free text. */
  redactPersonalIds(text: string): string;
  /** Whether a payment counterparty's name marks it as a company (e.g. "AB"). */
  looksLikeBusiness(name: string): boolean;
}
