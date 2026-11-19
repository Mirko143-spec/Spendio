import { NORDEA } from './nordea/index.ts';
import { NORDEA_PDF } from './nordea/pdf.ts';
import type { BankFormat } from './types.ts';

/** Every bank format with a built-in preset. Files that match none go to the generic mapper. */
export const BANK_FORMATS: readonly BankFormat[] = [NORDEA, NORDEA_PDF];

/** The first format that recognizes `text`, or undefined. */
export function detectFormat(text: string, formats: readonly BankFormat[] = BANK_FORMATS): BankFormat | undefined {
  return formats.find((format) => format.detect(text));
}
