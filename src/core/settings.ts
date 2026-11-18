import { DEFAULT_PERIOD_SETTINGS, type PeriodSettings } from './periods.ts';

/** App-wide settings (docs/SPEC.md §13). */
export interface AppSettings extends PeriodSettings {
  /** Version of the stored data layout, bumped on migrations and written into backups. */
  schemaVersion: number;
}

export const SCHEMA_VERSION = 1;

export const DEFAULT_SETTINGS: AppSettings = { ...DEFAULT_PERIOD_SETTINGS, schemaVersion: SCHEMA_VERSION };
