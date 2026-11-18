import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, SCHEMA_VERSION } from './settings.ts';

describe('DEFAULT_SETTINGS', () => {
  it('uses Swedish payday periods and the current schema version', () => {
    expect(DEFAULT_SETTINGS).toEqual({ startDay: 25, adjustToBankingDay: true, schemaVersion: SCHEMA_VERSION });
  });
});
