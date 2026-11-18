import { describe, expect, it } from 'vitest';
import { DEFAULT_ACCOUNT } from './account.ts';
import { DEFAULT_SETTINGS, SCHEMA_VERSION } from './settings.ts';

describe('DEFAULT_SETTINGS', () => {
  it('uses Swedish payday periods and the current schema version', () => {
    expect(DEFAULT_SETTINGS).toEqual({ startDay: 25, adjustToBankingDay: true, schemaVersion: SCHEMA_VERSION });
  });
});

describe('DEFAULT_ACCOUNT', () => {
  it('is the Nordea personal account, without any account number', () => {
    expect(DEFAULT_ACCOUNT).toEqual({ id: 'nordea-personkonto', bank: 'nordea', name: 'Personkonto' });
    expect(JSON.stringify(DEFAULT_ACCOUNT)).not.toMatch(/\d{4}/);
  });
});
