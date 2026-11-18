import type { Country } from '../types.ts';
import { BUILTIN_RULES } from './builtin-rules.ts';
import { looksLikeBusiness } from './business.ts';
import { isBankingDay } from './holidays.ts';
import { redactPersonnummer } from './personnummer.ts';

export const SWEDEN: Country = {
  code: 'SE',
  name: 'Sweden',
  currency: 'SEK',
  locale: 'sv-SE',
  defaultPeriodSettings: { startDay: 25, adjustToBankingDay: true },
  isBankingDay,
  builtinRules: BUILTIN_RULES,
  redactPersonalIds: redactPersonnummer,
  looksLikeBusiness,
};
