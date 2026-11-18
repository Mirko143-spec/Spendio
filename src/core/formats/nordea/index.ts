import { isNordeaCsv, parseNordeaCsv } from '../../csv/nordea.ts';
import { describeTransaction } from '../../describe.ts';
import type { BankFormat } from '../types.ts';

/** Nordea (Sweden) CSV export. See docs/SPEC.md §4.1. */
export const NORDEA: BankFormat = {
  id: 'nordea',
  name: 'Nordea',
  country: 'SE',
  detect: isNordeaCsv,
  parse: parseNordeaCsv,
  describe: describeTransaction,
};
