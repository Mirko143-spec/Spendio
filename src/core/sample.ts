import type { ImportBatch } from './import.ts';

/** Label of the import made by "Try Spendio with sample data". */
export const SAMPLE_DATA_LABEL = 'Sample data';

export function isSampleBatch(batch: Pick<ImportBatch, 'label'>): boolean {
  return batch.label === SAMPLE_DATA_LABEL;
}
