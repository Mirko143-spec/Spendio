/** Saved column mapping for the generic CSV importer (build step 6); stored as-is until then. */
export interface CsvMapping {
  id: string;
  /** Header row the mapping applies to. */
  headerSignature: string;
  [field: string]: unknown;
}
